import React, { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { Routes, Route, Link, useNavigate, useParams } from "react-router-dom";
import api from "./lib/api";

/* =======================================================
   ALERT SYSTEM (toasts + confirm modal) – in-file
   ======================================================= */

type ToastType = "success" | "error" | "info" | "warning";

type ToastItem = {
  id: string;
  type?: ToastType;
  title?: string;
  message: string;
  timeout?: number | null;
};

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
      const t = payload.timeout ?? 4000;
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

  return (
    <AlertsContext.Provider value={{ showToast, hideToast, confirm }}>
      {children}

      {/* Toast container (top-right) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-full max-w-sm px-4 sm:px-0">
        {toasts.map((t) => (
          <div key={t.id} className="w-full bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden animate-in slide-in-from-right duration-300">
            <div className={`p-4 flex items-start gap-3`}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg">
                {t.type === "success" && "✅"}
                {t.type === "error" && "❌"}
                {t.type === "warning" && "⚠️"}
                {!t.type && "ℹ️"}
              </div>
              <div className="flex-1 min-w-0">
                {t.title && <div className="font-bold text-sm mb-1">{t.title}</div>}
                <div className="text-xs text-gray-700">{t.message}</div>
              </div>
              <button onClick={() => hideToast(t.id)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors font-bold text-lg leading-none">×</button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6">
              {confirmModal.title && <div className="font-bold text-xl mb-3">{confirmModal.title}</div>}
              <div className="text-sm text-gray-700 leading-relaxed">{confirmModal.message}</div>
            </div>
            <div className="flex gap-3 p-4 bg-gray-50 border-t border-gray-100">
              <Button
                onClick={() => confirmModal.resolve(false)}
                variant="ghost"
              >
                {confirmModal.cancelLabel}
              </Button>
              <Button
                onClick={() => confirmModal.resolve(true)}
                variant="danger"
              >
                {confirmModal.okLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AlertsContext.Provider>
  );
}

/* =======================================================
   Helpers & utils
   ======================================================= */

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/* =======================================================
   UI components reused
   ======================================================= */

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-extrabold shadow-lg shadow-indigo-500/50 transition-transform hover:scale-105">TU</div>
      <div className="leading-tight">
        <div className="font-bold text-gray-900 text-lg">TâcheUnie</div>
        <div className="text-xs text-gray-500 -mt-0.5">Organise. Collabore. Avance.</div>
      </div>
    </div>
  );
}

function Button({ children, onClick, variant = "primary", type = "button" }: { children: any; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; type?: "button" | "submit" }) {
  const base = "px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95";
  const classes: Record<string, string> = {
    primary: base + " bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 focus:ring-indigo-500",
    ghost: base + " bg-white border-2 border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 focus:ring-indigo-500",
    danger: base + " bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 focus:ring-red-500",
  };
  return <button type={type} onClick={onClick} className={classes[variant]}>{children}</button>;
}

/* =======================================================
   Auth layouts / pages
   ======================================================= */

function AuthLayout({ children }: { children: any }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 sm:p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="hidden lg:flex flex-col gap-6 p-10 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-20"></div>
          <div className="relative z-10">
            <Logo />
            <h2 className="text-4xl font-bold mt-8 leading-tight">Organise tes tâches.<br/>Collabore mieux.</h2>
            <p className="opacity-90 text-lg mt-4">Application moderne pour gérer utilisateurs, groupes et tâches — responsive & élégante.</p>
            <div className="mt-12 flex items-center gap-3 text-sm opacity-90">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">📱</div>
              <span>Disponible sur mobile et desktop</span>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border border-white/20">{children}</div>
        
        <div className="lg:hidden text-center">
          <Logo />
        </div>
      </div>
    </div>
  );
}

function Login() {
  const [fullname, setFullname] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const alerts = useAlerts();

  async function submit(e: any) {
    e.preventDefault();
    setErr("");
    try {
      const res = await api.post("/auth/login", { fullname, password });
      localStorage.setItem("token", res.data.token);
      nav("/dashboard");
      alerts.showToast({ type: "success", title: "Connecté", message: "Bienvenue !", timeout: 2500 });
    } catch (err: any) {
      setErr(err?.response?.data?.message || "Erreur");
      alerts.showToast({ type: "error", title: "Erreur", message: err?.response?.data?.message || "Impossible de se connecter" });
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h3 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Se connecter</h3>
          <p className="text-sm text-gray-600 mt-2">Bon retour parmi nous ! 👋</p>
        </div>
        {err && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{err}</div>}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Nom complet</label>
          <input className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" value={fullname} onChange={(e) => setFullname(e.target.value)} placeholder="Ton nom complet" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Mot de passe</label>
          <input type="password" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
          <Button type="submit">Se connecter</Button>
          <Link to="/register" className="text-sm text-center sm:text-left text-indigo-600 hover:text-purple-600 font-medium transition-colors">Pas de compte ? Inscris-toi</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

function Register() {
  const [fullname, setFullname] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const nav = useNavigate();
  const alerts = useAlerts();

  async function submit(e: any) {
    e.preventDefault();
    setMsg("");
    try {
      await api.post("/auth/register", { fullname, password });
      setMsg("Compte créé — connecte-toi");
      alerts.showToast({ type: "success", title: "Compte créé", message: "Tu peux maintenant te connecter", timeout: 3000 });
      setTimeout(() => nav("/"), 800);
    } catch (err: any) {
      setMsg(err?.response?.data?.message || "Erreur");
      alerts.showToast({ type: "error", title: "Erreur", message: err?.response?.data?.message || "Impossible de créer le compte" });
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h3 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Créer un compte</h3>
          <p className="text-sm text-gray-600 mt-2">Rejoins-nous dès maintenant ! 🚀</p>
        </div>
        {msg && <div className="text-sm text-green-600 bg-green-50 px-4 py-3 rounded-xl">{msg}</div>}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Nom complet</label>
          <input className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" value={fullname} onChange={(e) => setFullname(e.target.value)} placeholder="Ton nom complet" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Mot de passe</label>
          <input type="password" className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
          <Button type="submit">S'inscrire</Button>
          <Link to="/" className="text-sm text-center sm:text-left text-indigo-600 hover:text-purple-600 font-medium transition-colors">Déjà inscrit ? Se connecter</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

/* =======================================================
   Header / Dashboard / GroupPage
   ======================================================= */

function Header({ onLogout }: { onLogout: () => void }) {
  return (
    <header className="flex items-center justify-between py-4 px-2">
      <Logo />
      <div className="flex items-center gap-2 sm:gap-3">
        <Link to="/dashboard" className="hidden sm:inline text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Tableau de bord</Link>
        <button onClick={onLogout} className="px-3 sm:px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium transition-all active:scale-95">Logout</button>
      </div>
    </header>
  );
}

function Dashboard() {
  const [groups, setGroups] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const nav = useNavigate();
  const alerts = useAlerts();

  React.useEffect(() => { fetchGroups(); }, []);

  async function fetchGroups() {
    try {
      const res = await api.get("/groups");
      setGroups(res.data);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        localStorage.removeItem("token");
        nav("/");
        return;
      }
      alerts.showToast({ type: "error", title: "Erreur", message: "Impossible de charger les groupes" });
      console.error(err);
    }
  }

  async function create() {
    if (!name) {
      alerts.showToast({ type: "info", message: "Donne un nom au groupe" });
      return;
    }
    try {
      const res = await api.post("/groups", { name });
      setGroups((prev) => [res.data, ...prev]);
      setName("");
      alerts.showToast({ type: "success", message: "Groupe créé" });
    } catch (err: any) {
      if (err?.response?.status === 401) {
        localStorage.removeItem("token");
        nav("/");
        return;
      }
      alerts.showToast({ type: "error", title: "Erreur", message: err?.response?.data?.message || "Impossible de créer le groupe" });
    }
  }

  async function join() {
    if (!joinCode) {
      alerts.showToast({ type: "info", message: "Entrer un code d'invitation" });
      return;
    }
    try {
      const res = await api.post("/groups/join", { code: joinCode });
      setGroups((prev) => [res.data, ...prev.filter(g => String(g._id) !== String(res.data._id))]);
      setJoinCode("");
      alerts.showToast({ type: "success", message: "Groupe rejoint" });
    } catch (err: any) {
      if (err?.response?.status === 401) {
        localStorage.removeItem("token");
        nav("/");
        return;
      }
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur" });
    }
  }

  function open(g: any) { const gid = g._id || g.id; nav(`/groups/${gid}`); }
  function logout() { localStorage.removeItem("token"); nav("/"); }

  const userId = getUserIdFromToken();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto px-4">
        <Header onLogout={logout} />
        
        <div className="mt-6 sm:mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Mes groupes</h2>
              <p className="text-sm text-gray-600 mt-1">Organise et collabore avec ton équipe</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white/80 backdrop-blur-xl p-4 sm:p-6 rounded-2xl shadow-xl border border-white/20">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder="Nom du groupe" value={name} onChange={(e) => setName(e.target.value)} />
                    <Button onClick={create}>➕ Créer</Button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder="Code d'invitation" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                    <Button onClick={join} variant="ghost">🔗 Rejoindre</Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {groups.length === 0 && (
                  <div className="col-span-full p-12 rounded-2xl bg-white/60 backdrop-blur-xl border-2 border-dashed border-gray-300 text-center">
                    <div className="text-4xl mb-3">📋</div>
                    <div className="font-semibold text-gray-700">Aucun groupe pour le moment</div>
                    <div className="text-sm text-gray-500 mt-1">Crée ton premier groupe pour commencer</div>
                  </div>
                )}
                {groups.map((g) => {
                  const ownerId = g.owner ? (g.owner._id || g.owner) : (Array.isArray(g.members) ? g.members[0] : null);
                  const isOwner = String(ownerId) === String(userId);
                  return (
                    <div key={g.id || g._id} className="group p-5 rounded-2xl bg-white/80 backdrop-blur-xl shadow-lg hover:shadow-2xl border border-white/20 cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95" onClick={() => open(g)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-lg text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{g.name}</div>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">👥 {g.members ? g.members.length : 1} membres</div>
                            {isOwner && <div className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">👑 Owner</div>}
                          </div>
                        </div>
                        <div className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">{g.inviteCode || "—"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="hidden lg:block">
              <div className="sticky top-6 p-6 rounded-2xl bg-white/80 backdrop-blur-xl shadow-xl border border-white/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="text-2xl">💡</div>
                  <h4 className="font-bold text-lg">Raccourcis</h4>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">Crée un groupe pour inviter d'autres utilisateurs via le code d'invitation unique.</p>
                <div className="mt-6 space-y-2">
                  <Link to="#" className="block text-sm font-medium text-indigo-600 hover:text-purple-600 transition-colors">→ Gérer les invitations</Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupPage() {
  const { id } = useParams();
  const [group, setGroup] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [deadline, setDeadline] = useState<string>("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const nav = useNavigate();

  const alerts = useAlerts();

  React.useEffect(() => {
    if (id) {
      fetchGroup();
      fetchTasks();
    }
    // eslint-disable-next-line
  }, [id]);

  async function fetchGroup() {
    try {
      const res = await api.get(`/groups/${id}`);
      setGroup(res.data);
    } catch (err: any) {
      if (err?.response?.status === 401) { localStorage.removeItem("token"); nav("/"); return; }
      alerts.showToast({ type: "error", message: "Impossible de charger le groupe" });
      console.error(err);
    }
  }

  async function fetchTasks() {
    try {
      const res = await api.get(`/tasks/group/${id}`);
      setTasks(res.data);
    } catch (err: any) {
      if (err?.response?.status === 401) { localStorage.removeItem("token"); nav("/"); return; }
      alerts.showToast({ type: "error", message: "Impossible de charger les tâches" });
      console.error(err);
    }
  }

  function validateDateNotPast(d: string) {
    if (!d) return true;
    const given = new Date(d); given.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return given >= today;
  }

  async function addTask() {
    if (!title) { alerts.showToast({ type: "info", message: "Titre requis" }); return; }
    if (deadline && !validateDateNotPast(deadline)) { alerts.showToast({ type: "error", message: "La deadline ne peut pas être dans le passé" }); return; }

    try {
      const payload: any = { title, description: desc, groupId: id };
      if (deadline) payload.deadline = new Date(deadline).toISOString();
      const res = await api.post("/tasks", payload);
      setTasks((prev) => [res.data, ...prev]);
      setTitle(""); setDesc(""); setDeadline("");
      alerts.showToast({ type: "success", message: "Tâche ajoutée" });
    } catch (err: any) {
      if (err?.response?.status === 401) { localStorage.removeItem("token"); nav("/"); return; }
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur création tâche" });
    }
  }

  function startEdit(t: any) {
    const tid = t._id || t.id;
    setEditingTaskId(tid);
    setEditTitle(t.title || "");
    setEditDesc(t.description || "");
    setEditDeadline(t.deadline ? new Date(t.deadline).toISOString().slice(0, 10) : "");
  }

  async function saveEdit() {
    if (!editingTaskId) return;
    if (editDeadline && !validateDateNotPast(editDeadline)) { alerts.showToast({ type: "error", message: "La deadline ne peut pas être dans le passé" }); return; }

    try {
      const payload: any = { title: editTitle, description: editDesc };
      if (editDeadline) payload.deadline = new Date(editDeadline).toISOString();
      else payload.deadline = null;
      await api.put(`/tasks/${editingTaskId}`, payload);
      setTasks((prev) => prev.map((t) => (String(t._id || t.id) === String(editingTaskId) ? { ...t, ...payload } : t)));
      setEditingTaskId(null); setEditTitle(""); setEditDesc(""); setEditDeadline("");
      alerts.showToast({ type: "success", message: "Tâche mise à jour" });
    } catch (err: any) {
      if (err?.response?.status === 401) { localStorage.removeItem("token"); nav("/"); return; }
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur mise à jour" });
    }
  }

  async function deleteTask(idTask: string) {
    const ok = await alerts.confirm({ message: "Supprimer cette tâche ?" , okLabel: "Supprimer", cancelLabel: "Annuler"});
    if (!ok) return;
    try {
      await api.delete(`/tasks/${idTask}`);
      setTasks((prev) => prev.filter((t) => String(t._id || t.id) !== String(idTask)));
      alerts.showToast({ type: "success", message: "Tâche supprimée" });
    } catch (err: any) {
      if (err?.response?.status === 401) { localStorage.removeItem("token"); nav("/"); return; }
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur suppression" });
    }
  }

  async function deleteGroup() {
    const ok = await alerts.confirm({ message: "Supprimer ce groupe et toutes ses tâches ?" , okLabel: "Supprimer", cancelLabel: "Annuler"});
    if (!ok) return;
    try {
      await api.delete(`/groups/${id}`);
      alerts.showToast({ type: "success", message: "Groupe supprimé" });
      nav("/dashboard");
    } catch (err: any) {
      if (err?.response?.status === 401) { localStorage.removeItem("token"); nav("/"); return; }
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur suppression groupe" });
    }
  }

  async function removeMember(memberId: string) {
    const ok = await alerts.confirm({ message: "Retirer ce membre du groupe ?" , okLabel: "Retirer", cancelLabel: "Annuler"});
    if (!ok) return;
    try {
      await api.delete(`/groups/${id}/members/${memberId}`);
      setGroup((g: any) => ({ ...g, members: (g.members || []).filter((m: any) => String((m._id || m) || m) !== String(memberId)) }));
      alerts.showToast({ type: "success", message: "Membre retiré" });
    } catch (err: any) {
      if (err?.response?.status === 401) { localStorage.removeItem("token"); nav("/"); return; }
      alerts.showToast({ type: "error", message: err?.response?.data?.message || "Erreur retrait membre" });
    }
  }

  const userId = getUserIdFromToken();
  const ownerId = group?.owner ? (group.owner._id || group.owner) : (Array.isArray(group?.members) ? group.members[0] : null);
  const isOwner = String(ownerId) === String(userId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <button onClick={() => nav("/dashboard")} className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-purple-600 transition-colors mb-3">
              <span>←</span> Retour au tableau de bord
            </button>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">{group?.name || "Groupe"}</h1>
            <div className="flex items-center gap-2 mt-2">
              <div className="text-xs font-medium text-gray-500 bg-white/80 px-3 py-1.5 rounded-full">Code: {group?.inviteCode || "—"}</div>
              <div className="text-xs font-medium text-gray-500 bg-white/80 px-3 py-1.5 rounded-full">👥 {group?.members?.length || 0} membres</div>
            </div>
          </div>
          {isOwner && (
            <Button variant="danger" onClick={deleteGroup}>🗑 Supprimer</Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/80 backdrop-blur-xl p-4 sm:p-6 rounded-2xl shadow-xl border border-white/20">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>✨</span>
                <span>Nouvelle tâche</span>
              </h3>
              <div className="space-y-3">
                <input className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder="Titre de la tâche" value={title} onChange={(e) => setTitle(e.target.value)} />
                <input className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
                <div className="flex flex-col sm:flex-row gap-3">
                  <input type="date" min={todayIso()} className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                  <Button onClick={addTask}>➕ Ajouter</Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {tasks.length === 0 && (
                <div className="p-12 rounded-2xl bg-white/60 backdrop-blur-xl border-2 border-dashed border-gray-300 text-center">
                  <div className="text-4xl mb-3">📝</div>
                  <div className="font-semibold text-gray-700">Aucune tâche</div>
                  <div className="text-sm text-gray-500 mt-1">Ajoute ta première tâche ci-dessus</div>
                </div>
              )}
              {tasks.map((t) => {
                const tid = t._id || t.id;
                const isEditing = String(editingTaskId) === String(tid);
                return (
                  <div key={tid} className="p-4 sm:p-5 rounded-2xl bg-white/80 backdrop-blur-xl shadow-lg border border-white/20 hover:shadow-xl transition-all">
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-3">
                            <input className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                            <input className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                            <input type="date" min={todayIso()} className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
                          </div>
                        ) : (
                          <>
                            <div className="font-bold text-lg text-gray-900">{t.title}</div>
                            <div className="text-sm text-gray-600 mt-1">{t.description}</div>
                            {t.deadline && (
                              <div className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mt-2">
                                <span>📅</span>
                                <span>{new Date(t.deadline).toLocaleDateString()}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex lg:flex-col gap-2 justify-end lg:justify-start">
                        {isEditing ? (
                          <>
                            <Button onClick={saveEdit}>💾 Sauver</Button>
                            <Button variant="ghost" onClick={() => setEditingTaskId(null)}>❌ Annuler</Button>
                          </>
                        ) : (
                          <>
                            <Button onClick={() => startEdit(t)} variant="ghost">✏️ Modifier</Button>
                            <Button onClick={() => deleteTask(tid)} variant="danger">🗑</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/20 h-fit sticky top-6">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span>👥</span>
              <span>Membres</span>
            </h4>
            <div className="space-y-3">
              {(group?.members || []).map((m: any) => {
                const memberId = typeof m === "string" ? m : (m._id || m.id || m);
                const isSelf = String(memberId) === String(userId);
                return (
                  <div key={String(memberId)} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(m.fullname || String(memberId))[0].toUpperCase()}
                      </div>
                      <div className="text-sm font-medium truncate">{m.fullname || String(memberId).slice(0, 8)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isSelf && <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">Moi</span>}
                      {isOwner && !isSelf && <button onClick={() => removeMember(memberId)} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Retirer</button>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-2">Code d'invitation</div>
              <code className="block px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl text-center font-mono font-bold text-indigo-600">{group?.inviteCode || "—"}</code>
              <p className="text-xs text-gray-500 mt-2 text-center">Partage ce code pour inviter des membres</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* =======================================================
   PrivateRoute & Exported App (wrap with AlertsProvider)
   ======================================================= */

function PrivateRoute({ children }: { children: any }) {
  const token = localStorage.getItem("token");
  if (!token) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-white/20 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <div className="mb-4 font-semibold text-gray-900">Vous devez être connecté</div>
        <Link to="/" className="text-indigo-600 hover:text-purple-600 font-medium transition-colors">Se connecter</Link>
      </div>
    </div>
  );
  return children;
}

export default function App() {
  return (
    <AlertsProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/groups/:id" element={<PrivateRoute><GroupPage /></PrivateRoute>} />
      </Routes>
    </AlertsProvider>
  );
}