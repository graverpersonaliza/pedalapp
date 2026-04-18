const admin = require("firebase-admin");
const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten, onDocumentDeleted } = require("firebase-functions/v2/firestore");

admin.initializeApp();
const db = admin.firestore();
const DEFAULT_CLIENT_TEMP_PASSWORD = process.env.CLIENT_TEMP_PASSWORD || "Pedala@2026!";

function assertDeveloper(request) {
  const claims = request.auth?.token || {};
  if (!claims.developer) {
    throw new HttpsError("permission-denied", "Apenas desenvolvedor pode executar esta ação.");
  }
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function displayNameForClient(data = {}) {
  return String(data.responsavel || data.sistemaNome || data.nome || "Admin PedalApp").trim().slice(0, 128);
}

function clientClaims(clientSlug = "") {
  return {
    developer: false,
    clientAdmin: true,
    staff: false,
    clientSlug,
    mustChangePassword: true
  };
}

async function writeAudit(type, payload = {}) {
  await db.collection("audit_logs").add({
    type,
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function disablePreviousAdmin(prevEmail, nextEmail, clientSlug) {
  const oldEmail = normalizeEmail(prevEmail);
  const newEmail = normalizeEmail(nextEmail);
  if (!oldEmail || oldEmail === newEmail) return;
  try {
    const oldUser = await admin.auth().getUserByEmail(oldEmail);
    await admin.auth().setCustomUserClaims(oldUser.uid, {
      developer: false,
      clientAdmin: false,
      staff: false,
      clientSlug: "",
      mustChangePassword: false
    });
    await admin.auth().updateUser(oldUser.uid, { disabled: true });
    await writeAudit("disablePreviousClientAdmin", {
      uid: oldUser.uid,
      email: oldEmail,
      clientSlug
    });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      console.error("Erro ao desativar admin antigo", error);
    }
  }
}

async function provisionClientAdmin(clientId, afterData = {}, beforeData = {}) {
  const email = normalizeEmail(afterData.adminEmail);
  const clientSlug = String(afterData.slug || clientId || "").trim();
  const ref = db.collection("developer_clients").doc(clientId);

  if (!email) {
    await ref.set({
      authAutoProvisioned: false,
      authStatus: "sem-email",
      authEmail: "",
      authUid: "",
      authLastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      authError: admin.firestore.FieldValue.delete()
    }, { merge: true });
    return { ok: false, reason: "sem-email" };
  }

  const displayName = displayNameForClient(afterData);
  let user;
  let created = false;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    user = await admin.auth().createUser({
      email,
      password: DEFAULT_CLIENT_TEMP_PASSWORD,
      displayName,
      disabled: afterData.status === "Bloqueado"
    });
    created = true;
  }

  await admin.auth().updateUser(user.uid, {
    email,
    displayName,
    disabled: afterData.status === "Bloqueado"
  });

  await admin.auth().setCustomUserClaims(user.uid, clientClaims(clientSlug));
  await disablePreviousAdmin(beforeData.adminEmail, email, clientSlug);

  const mergeData = {
    authUid: user.uid,
    authEmail: email,
    authStatus: afterData.status === "Bloqueado" ? "bloqueado" : "ativo",
    authAutoProvisioned: true,
    authPasswordMode: "temporary-default",
    authTempPasswordRotateRecommended: true,
    authLastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
    authError: admin.firestore.FieldValue.delete()
  };
  if (!afterData.authProvisionedAt) {
    mergeData.authProvisionedAt = admin.firestore.FieldValue.serverTimestamp();
  }
  await ref.set(mergeData, { merge: true });

  await writeAudit(created ? "autoCreateClientAdmin" : "autoSyncClientAdmin", {
    uid: user.uid,
    email,
    clientId,
    clientSlug
  });

  return { ok: true, uid: user.uid, email, created };
}

exports.setUserRole = onCall(async (request) => {
  assertDeveloper(request);
  const { uid, role, clientSlug = "" } = request.data || {};
  if (!uid || !role) {
    throw new HttpsError("invalid-argument", "uid e role são obrigatórios.");
  }
  const allowed = ["developer", "clientAdmin", "staff"];
  if (!allowed.includes(role)) {
    throw new HttpsError("invalid-argument", "role inválido.");
  }
  const claims = {
    developer: role === "developer",
    clientAdmin: role === "clientAdmin",
    staff: role === "staff",
    clientSlug
  };
  await admin.auth().setCustomUserClaims(uid, claims);
  await writeAudit("setUserRole", {
    uid,
    role,
    clientSlug
  });
  return { ok: true };
});

exports.createClientAdmin = onCall(async (request) => {
  assertDeveloper(request);
  const { email, password, displayName = "", clientSlug = "" } = request.data || {};
  if (!email || !password || !clientSlug) {
    throw new HttpsError("invalid-argument", "email, password e clientSlug são obrigatórios.");
  }

  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (e) {
    user = await admin.auth().createUser({ email, password, displayName });
  }

  await admin.auth().setCustomUserClaims(user.uid, {
    clientAdmin: true,
    clientSlug,
    developer: false,
    staff: false,
    mustChangePassword: true
  });

  await writeAudit("createClientAdmin", {
    uid: user.uid,
    email,
    clientSlug
  });

  return { ok: true, uid: user.uid, email };
});

exports.syncClientAdminAuth = onDocumentWritten("developer_clients/{clientId}", async (event) => {
  const before = event.data?.before?.data() || null;
  const after = event.data?.after?.data() || null;
  if (!after) return null;

  const tracked = ["adminEmail", "slug", "nome", "sistemaNome", "responsavel", "status"];
  const changed = !before || tracked.some((key) => String(before?.[key] || "") !== String(after?.[key] || ""));
  if (!changed) return null;

  try {
    return await provisionClientAdmin(event.params.clientId, after, before || {});
  } catch (error) {
    console.error("Falha ao provisionar admin do cliente", error);
    await db.collection("developer_clients").doc(event.params.clientId).set({
      authAutoProvisioned: false,
      authStatus: "erro",
      authError: error?.message || "Falha ao provisionar usuário no Auth.",
      authLastSyncAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await writeAudit("syncClientAdminError", {
      clientId: event.params.clientId,
      message: error?.message || String(error)
    });
    return null;
  }
});

exports.disableClientAdminOnDelete = onDocumentDeleted("developer_clients/{clientId}", async (event) => {
  const data = event.data?.data() || {};
  const email = normalizeEmail(data.adminEmail);
  if (!email) return null;
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, {
      developer: false,
      clientAdmin: false,
      staff: false,
      clientSlug: "",
      mustChangePassword: false
    });
    await admin.auth().updateUser(user.uid, { disabled: true });
    await writeAudit("disableClientAdminOnDelete", {
      uid: user.uid,
      email,
      clientId: event.params.clientId,
      clientSlug: data.slug || ""
    });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      console.error("Falha ao desativar admin do cliente excluído", error);
    }
  }
  return null;
});

exports.syncExpiredClients = onSchedule("every day 03:00", async () => {
  const snap = await db.collection("developer_clients").get();
  const now = new Date();
  const batch = db.batch();

  snap.forEach((doc) => {
    const data = doc.data() || {};
    if (!data.validade || data.plano === "Vitalício") return;
    const end = new Date(`${data.validade}T23:59:59`);
    if (Number.isNaN(end.getTime())) return;
    if (end < now && data.status !== "Bloqueado") {
      batch.set(doc.ref, {
        status: "Bloqueado",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  await batch.commit();
  return null;
});

exports.paymentWebhookPlaceholder = onRequest(async (req, res) => {
  await db.collection("billing_webhooks").add({
    provider: req.query.provider || "manual",
    method: req.method,
    headers: req.headers || {},
    body: req.body || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  res.status(200).json({ ok: true });
});
