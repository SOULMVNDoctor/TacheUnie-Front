// src/App.tsx
import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { Routes, Route, Link, useNavigate, useParams, Navigate } from "react-router-dom";
import { FiLogOut, FiUser, FiPlus, FiCalendar, FiEdit2, FiTrash2, FiClock } from "react-icons/fi";
import { HiOutlineUsers } from "react-icons/hi";
import api from "./lib/api";

/* ---------------------------
   Profile context (open drawer)
   --------------------------- */
const ProfileContext = createContext<{ open: () => void }>({ open: () => {} });
export const useProfile = () => useContext(ProfileContext);

/* ==========================
   Alerts (top-centered toasts + confirm modal)
   ========================== */

type ToastType = "success" | "error" | "info" | "warning";
type ToastItem = { id: string; type?: ToastType; title?: string; message: string; timeout?: number | null };

type ConfirmPayload = {
  id: string;
  title?: string;
  message: string;
  okLabel?: string;
  cancelLabel?: string;
  resolve: (v: boolean) => void;
};

type AlertsContextType = {
  showToast: (t: Omit<ToastItem, "id">) => string;
  hideToast: (id: string) => void;
  confirm: (opts: { title?: string; message: string; okLabel?: string; cancelLabel?: string }) => Promise<boolean>;
};

const AlertsContext = createContext<AlertsContextType | null>(null);
export const useAlerts = () => {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used inside AlertsProvider");
  return ctx;
};

function AlertsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmPayload | null>(null);

  const showToast = useCallback((payload: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    const item: ToastItem = { id, ...payload };
    setToasts((s) => [item, ...s]);
    if (payload.timeout !== null) {
      const t = payload.timeout ?? 3000;
      setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), t);
    }
    return id;
  }, []);

  const hideToast = useCallback((id: string) => setToasts((s) => s.filter((t) => t.id !== id)), []);

  const confirm = useCallback((opts: { title?: string; message: string; okLabel?: string; cancelLabel?: string }) => {
    return new Promise<boolean>((resolve) => {
      const id = Math.random().toString(36).slice(2, 9);
      setConfirmModal({
        id,
        title: opts.title,
        message: opts.message,
        okLabel: opts.okLabel ?? "OK",
        cancelLabel: opts.cancelLabel ?? "Annuler",
        resolve: (v: boolean) => {
          resolve(v);
          setConfirmModal(null);
        },
      });
    });
  }, []);

  function iconForType(t?: ToastType) {
    if (t === "success") return "✔️";
    if (t === "error") return "❌";
    if (t === "warning") return "⚠️";
    return "ℹ️";
  }

  return (
    <AlertsContext.Provider value={{ showToast, hideToast, confirm }}>
      {children}

      {/* Toasts top-center */}
      <div className="fixed inset-x-0 top-4 z-50 pointer-events-none flex justify-center items-start px-4">
        <div className="w-full max-w-lg pointer-events-auto space-y-3">
          {toasts.map((t) => (
            <div key={t.id} className="rounded-2xl shadow-lg bg-white/95 border border-gray-100 p-3 flex items-start gap-3 min-w-0">
              <div className="text-xl flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 text-gray-700 shrink-0">
                {iconForType(t.type)}
              </div>
              <div className="flex-1 min-w-0">
                {t.title && <div className="text-sm font-semibold text-gray-800 truncate">{t.title}</div>}
                <div className="text-sm text-gray-700 truncate">{t.message}</div>
              </div>
              <button onClick={() => hideToast(t.id)} className="text-gray-400 ml-2">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm modal centered */}
      {confirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6">
              {confirmModal.title && <div className="text-lg font-bold mb-2">{confirmModal.title}</div>}
              <div className="text-sm text-gray-700 mb-4">{confirmModal.message}</div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => confirmModal.resolve(false)} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm"> {confirmModal.cancelLabel} </button>
                <button onClick={() => confirmModal.resolve(true)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm"> {confirmModal.okLabel} </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AlertsContext.Provider>
  );
}

/* ==========================
   Helpers (date/time conversion + utils)
   ========================== */

function isoToLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tzOffset * 60000);
  return local.toISOString().slice(0, 16);
}

function localInputToIso(local?: string | null) {
  if (!local) return null;
  const d = new Date(local);
  return d.toISOString();
}

function nowLocalMin() {
  const d = new Date();
  d.setSeconds(0, 0);
  const tzOffset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tzOffset * 60000);
  return local.toISOString().slice(0, 16);
}

function getUserIdFromToken() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.id || payload._id || null;
  } catch {
    return null;
  }
}

function computeStatusFromDates(start?: string | null, end?: string | null) {
  if (!start && !end) return "En attente";
  const now = Date.now();
  const s = start ? new Date(start).getTime() : null;
  const e = end ? new Date(end).getTime() : null;

  if (s && now < s) return "En attente";
  if (e && now >= e) return "Terminée";
  if (s && e && now >= s && now < e) return "En cours";
  if (s && !e && now >= s) return "En cours";
  if (!s && e && now < e) return "En cours";
  return "En attente";
}

function sortByCreatedDesc<T extends { createdAt?: string; created_at?: string }>(arr: T[]) {
  return (arr || []).slice().sort((a, b) => {
    const ta = new Date(a.createdAt ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.createdAt ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });
}

/* ==========================
   UI primitives
   ========================== */

function IconAvatar({ children, onClick }: { children?: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 text-white flex items-center justify-center shadow">
      {children || <FiUser />}
    </button>
  );
}

function Badge({ children, color = "green" }: { children: any; color?: "green" | "yellow" | "gray" }) {
  const map: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700",
    yellow: "bg-yellow-50 text-yellow-700",
    gray: "bg-gray-100 text-gray-700",
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-medium ${map[color]}`}>{children}</span>;
}

function Header({ onLogout }: { onLogout: () => void }) {
  const profile = useProfile();
  return (
    <header className="flex flex-wrap items-center justify-between py-4 px-2">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-400 flex items-center justify-center text-white text-xl font-extrabold shadow">TU</div>
        <div className="min-w-0">
          <div className="text-lg font-bold truncate">TâcheUnie</div>
          <div className="text-xs text-gray-500 truncate">Organise. Collabore. Avance.</div>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-2">
        <div className="hidden sm:flex items-center gap-4 bg-white/80 border border-gray-100 rounded-2xl px-3 py-2 shadow-sm">
          <Link to="/dashboard" className="text-sm text-gray-700 hover:text-green-700">Tableau de bord</Link>
        </div>

        <div className="flex items-center gap-3">
          <button className="hidden md:inline-flex items-center gap-2 text-sm py-2 px-3 rounded-lg bg-white border border-gray-100 shadow-sm">
            <FiCalendar /> Aujourd'hui
          </button>

          <div className="relative">
            <IconAvatar onClick={() => profile.open()} />
          </div>

          <button onClick={onLogout} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-sm">
            <FiLogOut /> <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/* ==========================
   Auth pages
   ========================== */

function AuthLayout({ children }: { children: any }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-green-25 p-4">
      <div className="w-full max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center px-4 sm:px-6">
        <div className="hidden md:flex flex-col gap-6 p-8 rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-400 text-white shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white font-extrabold">TU</div>
            <div>
              <div className="font-bold text-lg">TâcheUnie</div>
              <div className="text-xs opacity-90">Organise. Collabore. Avance.</div>
            </div>
          </div>
          <h2 className="text-3xl font-bold">Organise tes tâches. Collabore mieux.</h2>
          <p className="opacity-90">Application simple pour gérer utilisateurs, groupes et tâches — responsive & moderne.</p>
          <div className="mt-auto small">Disponible sur mobile et desktop</div>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-md">{children}</div>
      </div>
    </div>
  );
}

/* ==========================
   Login / Register (unchanged)
   ========================== */

function Login() {
  const [fullname, setFullname] = useState("");
  const [password, setPassword] = useState("");
  const nav = useNavigate();
  const alerts = useAlerts();

  async function submit(e: any) {
    e.preventDefault();
    try {
      const res = await api.post("/auth/login", { fullname, password });
      const token = res.data.token ?? res.data.accessToken;
      if (token) {
        localStorage.setItem("token", token);
        api.defaults.headers.common = api.defaults.headers.common || {};
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      }
      alerts.showToast({ type: "success", title: "Connecté", message: "Bienvenue !", timeout: 2000 });
      nav("/dashboard");
    } catch (err: any) {
      alerts.showToast({ type: "error", title: "Erreur", message: err?.response?.data?.message || "Impossible de se connecter", timeout: 4000 });
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h3 className="text-3xl font-bold text-gray-900">Se connecter</h3>
          <p className="text-sm text-gray-600 mt-1">Bon retour parmi nous 👋</p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Nom complet</label>
          <input required value={fullname} onChange={(e) => setFullname(e.target.value)} className="w-full mt-2 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 outline-none" placeholder="Ton nom complet" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Mot de passe</label>
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mt-2 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 outline-none" placeholder="••••••••" />
        </div>

        <div className="flex items-center justify-between gap-4">
          <button type="submit" className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold">Se connecter</button>
          <Link to="/register" className="text-sm text-emerald-600">Pas de compte ? S'inscrire</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

function Register() {
  const [fullname, setFullname] = useState("");
  const [password, setPassword] = useState("");
  const nav = useNavigate();
  const alerts = useAlerts();

  async function submit(e: any) {
    e.preventDefault();
    try {
      const res = await api.post("/auth/register", { fullname, password });

      // si backend renvoie token (recommandé), on le stocke et on redirige directement vers le dashboard
      const token = res.data.token ?? res.data.accessToken;
      const user = res.data.user ?? null;
      if (token) {
        localStorage.setItem("token", token);
        if (user) localStorage.setItem("user", JSON.stringify(user));
        api.defaults.headers.common = api.defaults.headers.common || {};
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        alerts.showToast({ type: "success", title: "Compte créé", message: "Bienvenue !", timeout: 1500 });
        nav("/dashboard");
        return;
      }

      // fallback si pas de token renvoyé : afficher message et rediriger vers login
      alerts.showToast({ type: "success", title: "Compte créé", message: "Tu peux maintenant te connecter", timeout: 3000 });
      setTimeout(() => nav("/"), 700);
    } catch (err: any) {
      alerts.showToast({ type: "error", title: "Erreur", message: err?.response?.data?.message || "Impossible de créer le compte" });
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h3 className="text-3xl font-bold text-gray-900">Créer un compte</h3>
          <p className="text-sm text-gray-600 mt-1">Rejoins-nous dès maintenant ! 🚀</p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Nom complet</label>
          <input required value={fullname} onChange={(e) => setFullname(e.target.value)} className="w-full mt-2 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 outline-none" placeholder="Ton nom complet" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Mot de passe</label>
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mt-2 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 outline-none" placeholder="••••••••" />
        </div>

        <div className="flex items-center justify-between gap-4">
          <button type="submit" className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold">S'inscrire</button>
          <Link to="/" className="text-sm text-emerald-600">Déjà inscrit ? Se connecter</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

/* ==========================
   Dashboard & PersonalTasksBlock
   ========================== */

function Dashboard() {
  const [groups, setGroups] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const nav = useNavigate();
  const alerts = useAlerts();

  useEffect(() => { fetchGroups(); }, []);

  async function fetchGroups() {
    try {
      const res = await api.get("/groups");
      setGroups(sortByCreatedDesc(res.data || []));
    } catch (err: any) {
      if (err?.response?.status === 401) { localStorage.removeItem("token"); nav("/"); return; }
      alerts.showToast({ type: "error", message: "Impossible de charger les groupes" });
    }
  }

  async function create() {
    if (!name) { alerts.showToast({ type: "info", message: "Donne un nom au groupe" }); return; }
    try {
      const res = await api.post("/groups", { name });
      setGroups((prev) => sortByCreatedDesc([res.data, ...prev]));
      setName("");
      alerts.showToast({ type: "success", message: "Groupe créé" });
    } catch (err: any) {
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur création groupe" });
    }
  }

  async function join() {
    if (!joinCode) { alerts.showToast({ type: "info", message: "Entre un code" }); return; }
    try {
      const res = await api.post("/groups/join", { code: joinCode });
      setGroups((prev) => sortByCreatedDesc([res.data, ...prev.filter(g => String(g._id) !== String(res.data._id))]));
      setJoinCode("");
      alerts.showToast({ type: "success", message: "Groupe rejoint" });
    } catch (err: any) {
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur" });
    }
  }

  function open(g: any) { const gid = g._id || g.id; nav(`/groups/${gid}`); }
  function logout() { localStorage.removeItem("token"); nav("/"); }

  const userId = getUserIdFromToken();

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-emerald-50 via-white to-emerald-25 py-6">
      <div className="w-full max-w-full sm:max-w-3xl md:max-w-5xl lg:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Header onLogout={logout} />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <div className="p-4 sm:p-6 rounded-2xl bg-white shadow-lg border border-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex gap-3 min-w-0">
                  <input className="flex-1 px-4 py-3 rounded-xl border border-gray-200 min-w-0" placeholder="Nom du groupe" value={name} onChange={(e) => setName(e.target.value)} />
                  <button onClick={create} className="px-4 py-3 rounded-xl bg-emerald-600 text-white flex items-center gap-2 flex-shrink-0">
                    <span className="hidden sm:inline-flex"><FiPlus /></span>
                    <span>Créer</span>
                  </button>
                </div>

                <div className="flex gap-3 min-w-0">
                  <input className="flex-1 px-4 py-3 rounded-xl border border-gray-200 min-w-0" placeholder="Code d'invitation" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                  <button onClick={join} className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-emerald-600 flex-shrink-0">Rejoindre</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.length === 0 && (
                <div className="col-span-full p-6 rounded-2xl bg-white border-dashed border-2 border-gray-200 text-center">
                  <div className="text-lg sm:text-xl font-semibold">Aucun groupe — crée le premier</div>
                </div>
              )}

              {groups.map((g) => {
                const ownerId = g.owner ? (g.owner._id || g.owner) : (Array.isArray(g.members) ? g.members[0] : null);
                const isOwner = String(ownerId) === String(userId);
                return (
                  <div key={g._id || g.id} className="p-4 rounded-2xl bg-white shadow-sm cursor-pointer hover:shadow-md flex flex-col justify-between min-h-[110px] w-full" onClick={() => open(g)}>
                    <div>
                      <div className="font-semibold text-lg truncate">{g.name}</div>
                      <div className="text-sm text-gray-500 mt-2 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-50 text-xs"><HiOutlineUsers /> {g.members ? g.members.length : 1} membres</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded-lg truncate">{g.inviteCode || "—"}</div>
                      {isOwner && <div className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Propriétaire</div>}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-6 p-4 sm:p-6 rounded-2xl bg-white shadow-lg border border-gray-50 w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">💡</div>
                <div>
                  <div className="font-semibold">Raccourcis</div>
                  <div className="text-sm text-gray-600">Partage le code d'invitation pour inviter des membres.</div>
                </div>
              </div>
              <Link to="#" className="text-sm text-emerald-600 font-medium">→ Gérer les invitations</Link>
            </div>
          </aside>
        </div>

        {/* Personal tasks area */}
        <div className="mt-8 p-4 sm:p-6 rounded-2xl bg-white shadow-lg border border-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Tâches personnelles</h3>
            <div className="text-sm text-gray-500">Gère tes tâches hors groupes</div>
          </div>

          <PersonalTasksBlock />
        </div>
      </div>
    </div>
  );
}

/* ==========================
   Personal Tasks Block (create/edit/delete personal tasks)
   ========================== */

function PersonalTasksBlock() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const nav = useNavigate();
  const alerts = useAlerts();

  useEffect(() => { fetchPersonalTasks(); }, []);

  async function fetchPersonalTasks() {
    try {
      const res = await api.get("/tasks");
      const personal = (res.data || []).filter((t: any) => !t.groupId);
      setTasks(sortByCreatedDesc(personal));
    } catch (err: any) {
      if (err?.response?.status === 401) { localStorage.removeItem("token"); nav("/"); return; }
      alerts.showToast({ type: "error", message: "Impossible de charger les tâches" });
    }
  }

  function validateNotPastLocal(localValue?: string) {
    if (!localValue) return true;
    const given = new Date(localValue);
    return given.getTime() >= Date.now();
  }

  async function addTask() {
    if (!title) { alerts.showToast({ type: "info", message: "Titre requis" }); return; }
    if (startDate && !validateNotPastLocal(startDate)) { alerts.showToast({ type: "error", message: "La date/heure de début ne peut pas être passée" }); return; }
    if (endDate && startDate && new Date(endDate).getTime() < new Date(startDate).getTime()) { alerts.showToast({ type: "error", message: "La date/heure de fin doit être après la date de début" }); return; }

    try {
      const payload: any = { title, description };
      if (startDate) payload.startDate = localInputToIso(startDate);
      if (endDate) payload.endDate = localInputToIso(endDate);
      const res = await api.post("/tasks", payload);
      setTasks(prev => sortByCreatedDesc([res.data, ...prev]));
      setTitle(""); setDescription(""); setStartDate(""); setEndDate("");
      alerts.showToast({ type: "success", message: "Tâche personnelle ajoutée" });
    } catch (err: any) {
      if (err?.response?.status === 401) { localStorage.removeItem("token"); nav("/"); return; }
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur création tâche" });
    }
  }

  async function deleteTask(id: string) {
    const ok = await alerts.confirm({ message: "Supprimer cette tâche personnelle ?", okLabel: "Supprimer", cancelLabel: "Annuler" });
    if (!ok) return;
    try {
      await api.delete(`/tasks/${id}`);
      setTasks(prev => prev.filter(t => String(t._id || t.id) !== String(id)));
      alerts.showToast({ type: "success", message: "Tâche supprimée" });
    } catch (err: any) {
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur suppression" });
    }
  }

  function beginEdit(t: any) {
    const tid = t._id || t.id;
    setEditingId(tid);
    setEditTitle(t.title || "");
    setEditDescription(t.description || "");
    setEditStart(isoToLocalInput(t.startDate));
    setEditEnd(isoToLocalInput(t.endDate));
  }

  async function saveEdit() {
    if (!editingId) return;
    if (editStart && !validateNotPastLocal(editStart)) { alerts.showToast({ type: "error", message: "La date/heure de début ne peut pas être passée" }); return; }
    if (editStart && editEnd && new Date(editEnd).getTime() < new Date(editStart).getTime()) { alerts.showToast({ type: "error", message: "La date/heure de fin doit être après la date de début" }); return; }

    try {
      const payload: any = { title: editTitle, description: editDescription };
      if (editStart) payload.startDate = localInputToIso(editStart); else payload.startDate = null;
      if (editEnd) payload.endDate = localInputToIso(editEnd); else payload.endDate = null;

      const res = await api.put(`/tasks/${editingId}`, payload);
      setTasks(prev => sortByCreatedDesc(prev.map(t => (String(t._id || t.id) === String(editingId) ? res.data : t))));
      setEditingId(null); setEditTitle(""); setEditDescription(""); setEditStart(""); setEditEnd("");
      alerts.showToast({ type: "success", message: "Tâche mise à jour" });
    } catch (err: any) {
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur mise à jour" });
    }
  }

  return (
    <>
      {/* stacked title and description; dates + add button on next row (responsive) */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Titre</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 min-w-0 box-border"
            placeholder="Titre"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 min-w-0 box-border"
            placeholder="Description"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:max-w-[640px]">
            <label className="text-xs text-gray-600 mr-2 hidden sm:inline">Début</label>
            <input
              type="datetime-local"
              min={nowLocalMin()}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 w-full min-w-0 box-border pr-10"
            />
            <label className="text-xs text-gray-600 ml-3 mr-2 hidden sm:inline">Fin</label>
            <input
              type="datetime-local"
              min={nowLocalMin()}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 w-full min-w-0 box-border pr-10"
            />
          </div>

          <div className="w-full sm:w-auto flex justify-end">
            <button
              onClick={addTask}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white flex-shrink-0"
              aria-label="Ajouter une tâche"
            >
              <span className="hidden sm:inline-flex"><FiPlus /></span>
              <span>Ajouter</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3 mt-4">
        {tasks.length === 0 && <div className="rounded-xl p-6 bg-gray-50 text-center text-gray-600">Aucune tâche personnelle</div>}

        {tasks.map(t => {
          const tid = t._id || t.id;
          const status = computeStatusFromDates(t.startDate, t.endDate);
          const statusColor = status === "En cours" ? "bg-emerald-50 text-emerald-700" : status === "Terminée" ? "bg-gray-100 text-gray-700" : "bg-yellow-50 text-yellow-800";
          const startLabel = t.startDate ? new Date(t.startDate).toLocaleString() : "—";
          const endLabel = t.endDate ? new Date(t.endDate).toLocaleString() : "—";
          return (
            <div key={tid} className="p-4 rounded-2xl bg-white shadow-sm border border-gray-50 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-lg truncate">{t.title}</div>
                <div className="text-sm text-gray-600 mt-1 truncate">{t.description}</div>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 flex-wrap">
                  <div className="flex items-center gap-2"><FiClock /> Début: {startLabel}</div>
                  <div className="flex items-center gap-2"><FiCalendar /> Fin: {endLabel}</div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>{status}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <button onClick={() => beginEdit(t)} className="p-2 rounded-lg bg-white border border-gray-100"><FiEdit2 /></button>
                <button onClick={() => deleteTask(tid)} className="p-2 rounded-lg bg-red-50 text-red-600"><FiTrash2 /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline edit panel */}
      {editingId && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-60 w-full max-w-3xl p-4 bg-white rounded-2xl shadow-2xl border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Modifier la tâche</div>
            <div className="flex gap-2">
              <button onClick={() => { setEditingId(null); }} className="px-3 py-2 rounded-lg border">Annuler</button>
              <button onClick={saveEdit} className="px-3 py-2 rounded-lg bg-emerald-600 text-white">Enregistrer</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="px-4 py-3 rounded-xl border border-gray-200 col-span-2 min-w-0" placeholder="Titre" />
            <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="px-4 py-3 rounded-xl border border-gray-200 col-span-2 min-w-0" placeholder="Description" />
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-600 mr-2">Début</div>
              <input type="datetime-local" min={nowLocalMin()} value={editStart} onChange={(e) => setEditStart(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200" />
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-600 mr-2">Fin</div>
              <input type="datetime-local" min={nowLocalMin()} value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ==========================
   Group page
   ========================== */

function GroupPage() {
  const { id } = useParams();
  const [group, setGroup] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const nav = useNavigate();
  const alerts = useAlerts();

  useEffect(() => { if (id) { fetchGroup(); fetchTasks(); } }, [id]);

  async function fetchGroup() {
    try {
      const res = await api.get(`/groups/${id}`);
      setGroup(res.data);
    } catch (err: any) {
      if (err?.response?.status === 401) { localStorage.removeItem("token"); nav("/"); return; }
      alerts.showToast({ type: "error", message: "Impossible de charger le groupe" });
    }
  }

  async function fetchTasks() {
    try {
      const res = await api.get(`/tasks/group/${id}`);
      setTasks(sortByCreatedDesc(res.data || []));
    } catch (err: any) {
      alerts.showToast({ type: "error", message: "Impossible de charger les tâches" });
    }
  }

  function validateDateNotPastLocal(localVal?: string) {
    if (!localVal) return true;
    const given = new Date(localVal);
    return given.getTime() >= Date.now();
  }

  async function addTask() {
    if (!title) { alerts.showToast({ type: "info", message: "Titre requis" }); return; }
    if (startDate && !validateDateNotPastLocal(startDate)) { alerts.showToast({ type: "error", message: "La date/heure de début ne peut pas être passée" }); return; }
    if (endDate && startDate && new Date(endDate).getTime() < new Date(startDate).getTime()) { alerts.showToast({ type: "error", message: "La date/heure de fin doit être après la date de début" }); return; }

    try {
      const payload: any = { title, description: desc, groupId: id };
      if (startDate) payload.startDate = localInputToIso(startDate);
      if (endDate) payload.endDate = localInputToIso(endDate);
      const res = await api.post("/tasks", payload);
      setTasks(prev => sortByCreatedDesc([res.data, ...prev]));
      setTitle(""); setDesc(""); setStartDate(""); setEndDate("");
      alerts.showToast({ type: "success", message: "Tâche ajoutée" });
    } catch (err: any) {
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur création tâche" });
    }
  }

  function startEdit(t: any) {
    const tid = t._id || t.id;
    setEditingTaskId(tid);
    setEditTitle(t.title || "");
    setEditDesc(t.description || "");
    setEditStart(isoToLocalInput(t.startDate));
    setEditEnd(isoToLocalInput(t.endDate));
  }

  async function saveEdit() {
    if (!editingTaskId) return;
    if (editStart && !validateDateNotPastLocal(editStart)) { alerts.showToast({ type: "error", message: "La date/heure de début ne peut pas être passée" }); return; }
    if (editStart && editEnd && new Date(editEnd).getTime() < new Date(editStart).getTime()) { alerts.showToast({ type: "error", message: "La date/heure de fin doit être après la date de début" }); return; }

    try {
      const payload: any = { title: editTitle, description: editDesc };
      if (editStart) payload.startDate = localInputToIso(editStart); else payload.startDate = null;
      if (editEnd) payload.endDate = localInputToIso(editEnd); else payload.endDate = null;

      const res = await api.put(`/tasks/${editingTaskId}`, payload);
      setTasks(prev => sortByCreatedDesc(prev.map(t => (String(t._id || t.id) === String(editingTaskId) ? res.data : t))));
      setEditingTaskId(null); setEditTitle(""); setEditDesc(""); setEditStart(""); setEditEnd("");
      alerts.showToast({ type: "success", message: "Tâche mise à jour" });
    } catch (err: any) {
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur mise à jour" });
    }
  }

  async function deleteTask(idTask: string) {
    const ok = await alerts.confirm({ message: "Supprimer cette tâche ?", okLabel: "Supprimer", cancelLabel: "Annuler" });
    if (!ok) return;
    try {
      await api.delete(`/tasks/${idTask}`);
      setTasks(prev => prev.filter((t: any) => String(t._id || t.id) !== String(idTask)));
      alerts.showToast({ type: "success", message: "Tâche supprimée" });
    } catch (err: any) {
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur suppression" });
    }
  }

  async function deleteGroup() {
    const ok = await alerts.confirm({ message: "Supprimer ce groupe et toutes ses tâches ?", okLabel: "Supprimer", cancelLabel: "Annuler" });
    if (!ok) return;
    try {
      await api.delete(`/groups/${id}`);
      alerts.showToast({ type: "success", message: "Groupe supprimé" });
      nav("/dashboard");
    } catch (err: any) {
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur suppression groupe" });
    }
  }

  async function removeMember(memberId: string) {
    const ok = await alerts.confirm({ message: "Supprimer ce membre du groupe ?", okLabel: "Supprimer", cancelLabel: "Annuler" });
    if (!ok) return;
    try {
      await api.delete(`/groups/${id}/members/${memberId}`);
      setGroup((g: any) => ({ ...g, members: (g?.members || []).filter((m: any) => {
        const mid = typeof m === "string" ? m : (m._id || m.id || m);
        return String(mid) !== String(memberId);
      }) }));
      alerts.showToast({ type: "success", message: "Membre supprimé" });
    } catch (err: any) {
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur suppression membre" });
    }
  }

  const userId = getUserIdFromToken();
  const ownerId = group?.owner ? (group.owner._id || group.owner) : (Array.isArray(group?.members) ? group.members[0] : null);
  const isOwner = String(ownerId) === String(userId);

  async function copyInviteCode() {
    try {
      const code = group?.inviteCode || "";
      if (!code) return alerts.showToast({ type: "info", message: "Aucun code" });
      await navigator.clipboard.writeText(code);
      alerts.showToast({ type: "success", message: "Code d'invitation copié" });
    } catch (e) {
      alerts.showToast({ type: "error", message: "Impossible de copier le code" });
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-emerald-50 via-white to-emerald-25 py-6">
      <div className="w-full max-w-full sm:max-w-3xl md:max-w-5xl lg:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => nav("/dashboard")} className="text-sm text-emerald-600">◀ Retour</button>
            <h1 className="text-2xl sm:text-3xl font-bold mt-2">{group?.name || "Groupe"}</h1>
            <div className="text-sm text-gray-600 mt-1">Code d'invitation: {group?.inviteCode || "—"}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">Membres: {group?.members?.length || 0}</div>
            {isOwner && <button onClick={deleteGroup} className="px-3 sm:px-4 py-2 sm:py-2 bg-red-500 text-white rounded-lg">Supprimer</button>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-50">
              <h3 className="text-lg font-semibold mb-4">Nouvelle tâche</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Titre</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Titre"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 min-w-0 box-border"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
                  <input
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Description"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 min-w-0 box-border"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex items-center gap-2 w-full sm:max-w-[640px]">
                    <label className="text-xs text-gray-600 mr-2 hidden sm:inline">Début</label>
                    <input
                      type="datetime-local"
                      min={nowLocalMin()}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-gray-200 w-full min-w-0 box-border pr-10"
                    />

                    <label className="text-xs text-gray-600 ml-3 mr-2 hidden sm:inline">Fin</label>
                    <input
                      type="datetime-local"
                      min={nowLocalMin()}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-gray-200 w-full min-w-0 box-border pr-10"
                    />
                  </div>

                  <div className="w-full sm:w-auto flex justify-end">
                    <button onClick={addTask} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white" aria-label="Ajouter une tâche">
                      <span className="hidden sm:inline-flex"><FiPlus /></span>
                      <span>Ajouter</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {tasks.length === 0 && <div className="p-6 rounded-2xl bg-gray-50 text-center">Aucune tâche</div>}
              {tasks.map((t: any) => {
                const tid = t._id || t.id;
                const status = computeStatusFromDates(t.startDate, t.endDate);
                const badgeColor = status === "En cours" ? "green" : status === "Terminée" ? "gray" : "yellow";
                return (
                  <div key={tid} className="p-4 rounded-2xl bg-white shadow-sm border border-gray-50 flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-lg truncate">{t.title}</div>
                      <div className="text-sm text-gray-600 mt-1 truncate">{t.description}</div>
                      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 flex-wrap">
                        <div className="flex items-center gap-1"><FiClock /> Début: {t.startDate ? new Date(t.startDate).toLocaleString() : "—"}</div>
                        <div className="flex items-center gap-1"><FiCalendar /> Fin: {t.endDate ? new Date(t.endDate).toLocaleString() : "—"}</div>
                        <div><Badge color={badgeColor as any}>{status}</Badge></div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      {String(editingTaskId) === String(tid) ? (
                        <>
                          <button onClick={saveEdit} className="px-3 py-2 rounded-lg bg-emerald-600 text-white">Enregistrer</button>
                          <button onClick={() => setEditingTaskId(null)} className="px-3 py-2 rounded-lg border">Annuler</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(t)} className="p-2 rounded-lg bg-white border"><FiEdit2 /></button>
                          <button onClick={() => deleteTask(tid)} className="p-2 rounded-lg bg-red-50 text-red-600"><FiTrash2 /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-50">
            <h4 className="font-semibold text-lg mb-3">Membres</h4>
            <div className="space-y-3">
              {(group?.members || []).map((m: any) => {
                const memberId = typeof m === "string" ? m : (m._id || m.id || m);
                const isSelf = String(memberId) === String(getUserIdFromToken());
                const isOwnerMember = String(memberId) === String(group?.owner?._id || group?.owner);
                return (
                  <div key={String(memberId)} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-emerald-200 text-emerald-700 flex items-center justify-center font-semibold">{(m.fullname || String(memberId))[0]?.toUpperCase()}</div>
                      <div className="text-sm font-medium truncate">{m.fullname || String(memberId).slice(0,8)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-500">
                        {isSelf ? <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Moi</span> : null}
                        {isOwnerMember && !isSelf ? <span className="ml-2 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Propriétaire</span> : null}
                      </div>

                      {isOwner && !isOwnerMember && !isSelf && (
                        <button onClick={() => removeMember(String(memberId))} title="Retirer du groupe" className="px-2 py-1 rounded-lg bg-red-50 text-red-600 text-xs">Supprimer</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <div className="text-sm font-medium text-gray-700 mb-2">Code d'invitation</div>

              <button
                onClick={copyInviteCode}
                className="block w-full text-left px-4 py-3 bg-emerald-50 rounded-xl text-center font-mono font-semibold text-emerald-700 hover:brightness-95"
                title="Cliquer pour copier le code"
              >
                {group?.inviteCode || "—"}
              </button>

              <p className="text-xs text-gray-500 mt-2 text-center">Partage ce code pour inviter des membres</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ==========================
   Profile Drawer (global)
   ========================== */

function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [user, setUser] = useState<any>(null);
  const nav = useNavigate();
  const alerts = useAlerts();

  useEffect(() => {
    if (open) fetchMe();
  }, [open]);

  async function fetchMe() {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch (err: any) {
      if (err?.response?.status === 401) { localStorage.removeItem("token"); nav("/"); return; }
      alerts.showToast({ type: "error", message: "Impossible de lire le profil" });
    }
  }

  function logout() {
    localStorage.removeItem("token");
    onClose();
    nav("/");
  }

  async function deleteAccount() {
    const ok = await alerts.confirm({ title: "Supprimer le compte", message: "Es-tu sûr de vouloir supprimer ton compte ? Cette action est irréversible.", okLabel: "Supprimer", cancelLabel: "Annuler" });
    if (!ok) return;
    try {
      await api.delete("/auth/me");
      alerts.showToast({ type: "success", message: "Compte supprimé" });
      localStorage.removeItem("token");
      onClose();
      nav("/");
    } catch (err: any) {
      try {
        const uid = getUserIdFromToken();
        if (uid) {
          await api.delete(`/users/${uid}`);
          alerts.showToast({ type: "success", message: "Compte supprimé" });
          localStorage.removeItem("token");
          onClose();
          nav("/");
          return;
        }
      } catch {}
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur suppression compte" });
    }
  }

  return (
    <div className={`fixed inset-0 z-70 transition-transform ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/30 ${open ? "opacity-100" : "opacity-0"} transition-opacity`}></div>
      <div className={`absolute right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl p-4 sm:p-6 transform transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">TU</div>
            <div>
              <div className="text-lg font-semibold">{user?.fullname || "Utilisateur"}</div>
              <div className="text-xs text-gray-500">Membre depuis {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>

        <div className="mb-6">
          <div className="text-sm text-gray-600 mb-2">Informations</div>
          <div className="text-sm"><span className="font-medium">Nom complet:</span> {user?.fullname}</div>
          <div className="text-sm mt-2"><span className="font-medium">Email:</span> {user?.email || "—"}</div>
        </div>

        <div className="space-y-3">
          <button onClick={logout} className="w-full px-4 py-3 rounded-xl bg-red-500 text-white flex items-center justify-center gap-2"><FiLogOut /> Déconnexion</button>
          <button onClick={deleteAccount} className="w-full px-4 py-3 rounded-xl bg-transparent border border-red-200 text-red-600">Supprimer mon compte</button>
        </div>
      </div>
    </div>
  );
}

/* ==========================
   PrivateRoute & App
   ========================== */

function PrivateRoute({ children }: { children: any }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();

  // On load: if token exists in localStorage, inject it to axios defaults
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api.defaults.headers.common = api.defaults.headers.common || {};
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  return (
    <AlertsProvider>
      <ProfileContext.Provider value={{ open: () => setProfileOpen(true) }}>
        <div className="min-h-screen w-full">
          <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
          <Routes>
            {/* If user already logged in, redirect to dashboard */}
            <Route path="/" element={localStorage.getItem("token") ? <Navigate to="/dashboard" replace /> : <Login />} />
            <Route path="/register" element={localStorage.getItem("token") ? <Navigate to="/dashboard" replace /> : <Register />} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/groups/:id" element={<PrivateRoute><GroupPage /></PrivateRoute>} />
          </Routes>
        </div>
      </ProfileContext.Provider>
    </AlertsProvider>
  );
}
