"use client";

import { useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  displayName: string;
  name: string;
};

type Section = {
  id: string;
  name: string;
  slug: string;
  isPrivate?: boolean;
  groupId?: string;
};

type Group = {
  id: string;
  name: string;
  description: string;
  adminId: string;
  adminIds: string[];
  memberIds: string[];
  createdAt: string;
};

type Item = {
  id: string;
  label: string;
  userName: string;
  userId?: string;
  createdAt: string;
  status: 'open' | 'in-progress' | 'done';
  pinned: boolean;
  reactions: { emoji: string; userIds: string[] }[];
};

type Notification = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  groupId?: string | null;
  createdAt: string;
};

type ActivityEvent = {
  id: string;
  type: string;
  userName: string;
  detail: string;
  createdAt: string;
};

type Me = {
  id: string;
  displayName: string;
  name: string;
  isAdmin?: boolean;
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || "Request failed");
  }
  return res.json() as Promise<T>;
}

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [gateOk, setGateOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [keyInput, setKeyInput] = useState("");
  const [authMode, setAuthMode] = useState<"enroll" | "login">("enroll");
  const [nameInput, setNameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [profileNameInput, setProfileNameInput] = useState("");
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState("");

  const [users, setUsers] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<User[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "sections" | "groups" | "profile">(
    "groups"
  );

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupMemberToAdd, setGroupMemberToAdd] = useState("");
  const [showInviteMenu, setShowInviteMenu] = useState(false);
  const [showSectionMenu, setShowSectionMenu] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [inviteTargetGroupId, setInviteTargetGroupId] = useState("");
  // Group sub-screens: null = main group view, 'create-section' | 'invite' | 'settings' | 'activity'
  const [groupSubScreen, setGroupSubScreen] = useState<null | 'create-section' | 'invite' | 'settings' | 'activity'>(null);
  const [groupDescription, setGroupDescription] = useState("");
  const [groupSettingsMembers, setGroupSettingsMembers] = useState<{ id: string; displayName: string; name: string; isAdmin: boolean }[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Activity feed
  const [groupActivity, setGroupActivity] = useState<ActivityEvent[]>([]);

  // Invite link
  const [groupInviteToken, setGroupInviteToken] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) || null,
    [sections, selectedSectionId]
  );

  useEffect(() => {
    if (me) {
      setProfileNameInput(me.displayName);
    }
  }, [me]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("stagshub-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : prefersDark
        ? "dark"
        : "light";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const gate = await api<{ ok: boolean }>("/api/gate");
        if (!mounted) return;
        setGateOk(gate.ok);
        const meRes = await fetch("/api/me", { credentials: "include" });
        if (meRes.ok) {
          const meData = (await meRes.json()) as Me;
          if (!mounted) return;
          setMe(meData);
          await Promise.all([loadUsers(), loadGroups(), loadFriends(), loadFriendRequests(), loadNotifications()]);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("stagshub-theme", next);
  };

  const loadFriends = async () => {
    try {
      const data = await api<User[]>("/api/friends");
      setFriends(data);
    } catch (e) {
      console.error("Failed to load friends", e);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const data = await api<{ incoming: User[]; outgoing: User[] }>("/api/friends/requests");
      setIncomingRequests(data.incoming);
      setOutgoingRequests(data.outgoing);
    } catch (e) {
      console.error("Failed to load friend requests", e);
    }
  };

  const loadUsers = async () => {
    const data = await api<User[]>("/api/users");
    setUsers(data);
  };

  const loadSections = async (groupId?: string | null) => {
    const url = groupId ? `/api/groups/${groupId}/sections` : "/api/sections";
    const data = await api<Section[]>(url);
    setSections(data);
    // Only preserve the existing selection if it's still in the new list — never auto-jump
    const stillValid = data.some((s) => s.id === selectedSectionId);
    if (!stillValid) {
      setSelectedSectionId(null);
      setItems([]);
    }
  };

  const loadGroups = async () => {
    const data = await api<Group[]>("/api/groups");
    setGroups(data);
  };

  const loadItems = async (sectionId: string) => {
    const data = await api<Item[]>(`/api/sections/${sectionId}/items`);
    setItems(data);
  };

  const loadNotifications = async () => {
    try {
      const data = await api<Notification[]>("/api/notifications");
      setNotifications(data);
    } catch (e) {
      console.error("Failed to load notifications", e);
    }
  };

  const loadGroupActivity = async (groupId: string) => {
    try {
      const data = await api<ActivityEvent[]>(`/api/groups/${groupId}/activity`);
      setGroupActivity(data);
    } catch (e) {
      console.error("Failed to load activity", e);
    }
  };

  const toggleReaction = async (itemId: string, emoji: string) => {
    try {
      const data = await api<{ reactions: { emoji: string; userIds: string[] }[] }>(
        `/api/items/${itemId}/reactions`,
        { method: "POST", body: JSON.stringify({ emoji }) }
      );
      setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, reactions: data.reactions } : item));
    } catch (e) {
      console.error("Failed to toggle reaction", e);
    }
  };

  const cycleItemStatus = async (itemId: string, current: 'open' | 'in-progress' | 'done') => {
    const next = current === 'open' ? 'in-progress' : current === 'in-progress' ? 'done' : 'open';
    try {
      await api(`/api/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, status: next } : item));
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const toggleItemPin = async (itemId: string, pinned: boolean) => {
    try {
      await api(`/api/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ pinned: !pinned }) });
      setItems((prev) => {
        const updated = prev.map((item) => item.id === itemId ? { ...item, pinned: !pinned } : item);
        return [...updated.filter(i => i.pinned), ...updated.filter(i => !i.pinned)];
      });
    } catch (e) {
      console.error("Failed to pin item", e);
    }
  };

  const handleGetInviteLink = async (groupId: string) => {
    try {
      const data = await api<{ token: string }>(`/api/groups/${groupId}/invite-link`);
      setGroupInviteToken(data.token);
    } catch (e) {
      console.error("Failed to get invite link", e);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!groupInviteToken) return;
    const url = `${window.location.origin}/api/invite/${groupInviteToken}`;
    await navigator.clipboard.writeText(url);
    setInviteLinkCopied(true);
    setTimeout(() => setInviteLinkCopied(false), 2000);
  };

  const markNotificationsRead = async () => {
    try {
      await api("/api/notifications", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.error("Failed to mark notifications read", e);
    }
  };


  const handleGateSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    try {
      const result = await api<{ ok: boolean }>("/api/gate", {
        method: "POST",
        body: JSON.stringify({ key: keyInput }),
      });
      setGateOk(result.ok);
      setKeyInput("");
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    try {
      if (authMode === "enroll") {
        await api("/api/users/enroll", {
          method: "POST",
          body: JSON.stringify({ name: nameInput, password: passwordInput }),
        });
      }
      const meData = await api<Me>("/api/users/login", {
        method: "POST",
        body: JSON.stringify({ name: nameInput, password: passwordInput }),
      });
      setMe(meData);
      await Promise.all([loadUsers(), loadGroups(), loadFriends(), loadFriendRequests()]);
      setNameInput("");
      setPasswordInput("");
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleAddSection = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    try {
      const url = selectedGroupId
        ? `/api/groups/${selectedGroupId}/sections`
        : "/api/sections";

      await api(url, {
        method: "POST",
        body: JSON.stringify({ name: newSectionName }),
      });
      setNewSectionName("");
      await loadSections(selectedGroupId);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!me || !newPasswordInput) return;
    setNotice(null);
    try {
      await api("/api/me", {
        method: "PUT",
        body: JSON.stringify({ password: newPasswordInput }), // Assuming the backend handles this naturally like display name
      });
      setNewPasswordInput("");
      setShowPasswordChange(false);
      setNotice("Password successfully changed!");
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleCreateGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    try {
      await api("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: newGroupName }),
      });
      setNewGroupName("");
      await loadGroups();
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleSelectGroup = async (groupId: string | null) => {
    setSelectedGroupId(groupId);
    setSelectedSectionId(null);
    await loadSections(groupId);
  };

  const handleInviteToGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedGroupId || !groupMemberToAdd) return;
    setNotice(null);
    try {
      await api(`/api/groups/${selectedGroupId}/invite`, {
        method: "POST",
        body: JSON.stringify({ userId: groupMemberToAdd }),
      });
      setGroupMemberToAdd("");
      await loadGroups();
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
    setNotice(null);
    try {
      await api("/api/friends/requests", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadFriendRequests();
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleAcceptRequest = async (userId: string) => {
    setNotice(null);
    try {
      await api("/api/friends/requests", {
        method: "PUT",
        body: JSON.stringify({ userId }),
      });
      await Promise.all([loadFriends(), loadFriendRequests()]);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleDeclineOrCancelRequest = async (userId: string) => {
    setNotice(null);
    try {
      await api("/api/friends/requests", {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      });
      await loadFriendRequests();
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleUnfriend = async (userId: string) => {
    setNotice(null);
    try {
      await api("/api/friends", {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      });
      await loadFriends();
    } catch (error) {
      setNotice((error as Error).message);
    }
  };


  const handleDeleteGroup = async (groupId: string) => {
    setNotice(null);
    try {
      if (!window.confirm("Are you sure you want to delete this group and all its sections/items?")) return;
      await api(`/api/groups/${groupId}`, { method: "DELETE" });
      setSelectedGroupId(null);
      await loadGroups();
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleRemoveMember = async (groupId: string, userId: string) => {
    setNotice(null);
    try {
      await api(`/api/groups/${groupId}/members`, {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      });

      // If the user removed themselves, deselect the group
      if (me?.id === userId) {
        setSelectedGroupId(null);
        setGroupSubScreen(null);
      }

      await loadGroups();
      // Refresh settings members if settings screen is open
      if (groupSubScreen === 'settings') {
        await loadGroupSettings(groupId);
      }
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const loadGroupSettings = async (groupId: string) => {
    try {
      const data = await api<{ id: string; name: string; description: string; originalAdminId: string; adminIds: string[]; members: { id: string; displayName: string; name: string; isAdmin: boolean }[] }>(`/api/groups/${groupId}/settings`);
      setGroupDescription(data.description ?? "");
      setGroupSettingsMembers(data.members);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleOpenSettings = async () => {
    if (!selectedGroupId) return;
    setGroupSubScreen('settings');
    setShowGroupMenu(false);
    await loadGroupSettings(selectedGroupId);
  };

  const handleSaveGroupSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) return;
    setNotice(null);
    try {
      await api(`/api/groups/${selectedGroupId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ description: groupDescription }),
      });
      await loadGroups();
      setNotice("Group settings saved.");
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleKickMember = async (userId: string) => {
    if (!selectedGroupId) return;
    setNotice(null);
    try {
      await api(`/api/groups/${selectedGroupId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ action: "kick", userId }),
      });
      await loadGroups();
      await loadGroupSettings(selectedGroupId);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handlePromoteToAdmin = async (userId: string) => {
    if (!selectedGroupId) return;
    setNotice(null);
    try {
      await api(`/api/groups/${selectedGroupId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ action: "promote", userId }),
      });
      await loadGroups();
      await loadGroupSettings(selectedGroupId);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleAddItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSectionId) return;
    setNotice(null);
    try {
      await api(`/api/sections/${selectedSectionId}/items`, {
        method: "POST",
        body: JSON.stringify({ label: newItemLabel }),
      });
      setNewItemLabel("");
      await loadItems(selectedSectionId);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleSelectSection = async (sectionId: string | null) => {
    setSelectedSectionId(sectionId);
    if (sectionId) await loadItems(sectionId);
    else setItems([]);
  };

  const handleUpdateName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!me) return;
    setNotice(null);
    try {
      const updated = await api<Me>("/api/me", {
        method: "PUT",
        body: JSON.stringify({ displayName: profileNameInput }),
      });
      setMe(updated);
      await loadUsers();
      setProfileNameInput("");
    } catch (error) {
      setNotice((error as Error).message);
    }
  };



  const handleLogout = async () => {
    try {
      await api("/api/logout", { method: "POST" });
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setMe(null);
      setUsers([]);
      setSections([]);
      setItems([]);
      setGroups([]);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    setNotice(null);
    try {
      await api(`/api/sections/${sectionId}`, { method: "DELETE" });
      await loadSections(selectedGroupId);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedSectionId) return;
    setNotice(null);
    try {
      await api(`/api/items/${itemId}`, { method: "DELETE" });
      await loadItems(selectedSectionId);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <div className="card">Loading StagsHub...</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {me && (
        <div className="top-bar-actions" style={{ alignItems: 'center', gap: '10px' }}>
          {/* Notifications Bell */}
          <div style={{ position: 'relative' }}>
            <button
              className="gh-dots-btn"
              style={{ fontSize: '1.1rem' }}
              onClick={() => {
                setShowNotifications((v) => !v);
                if (!showNotifications) markNotificationsRead();
              }}
              title="Notifications"
            >
              🔔
              {notifications.filter((n) => !n.read).length > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px',
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: 'var(--accent-rose)', color: '#fff',
                  fontSize: '0.7rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--bg)',
                }}>
                  {Math.min(notifications.filter((n) => !n.read).length, 9)}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="gh-dropdown" style={{ width: '300px', right: 0, maxHeight: '380px', overflowY: 'auto' }}>
                <div style={{ padding: '10px 14px 6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Notifications
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                    All caught up! 🎉
                  </div>
                ) : notifications.map((n) => (
                  <button
                    key={n.id}
                    className="gh-menu-item"
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '3px', opacity: n.read ? 0.65 : 1 }}
                    onClick={() => {
                      setShowNotifications(false);
                      if (n.groupId) { setSelectedGroupId(n.groupId); setActiveTab('groups'); }
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', fontWeight: n.read ? 400 : 600 }}>{n.message}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn-outline" onClick={toggleTheme}>
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
          <button className="btn-outline" onClick={handleLogout}>Logout</button>
        </div>
      )}
      {!me && (
        <div className="hero">
          <div className="toolbar">
            <div className="brand">
              <div className="brand-mark" />
              <div>
                <h1>StagsHub</h1>
                <p>Private roster for shared sections and cards.</p>
              </div>
            </div>
            <div className="toolbar-actions">
              <span className="pill">Locked</span>
              <button className="btn-outline" onClick={toggleTheme}>
                {theme === "light" ? "dark mode" : "light mode"}
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && <div className="notice-banner">{notice}</div>}

      {!gateOk ? (
        <div className="grid grid-2 fade-in">
          <div className="card">
            <h2 className="card-title">Enter the Secret Key</h2>
            <p className="card-sub">
              This key unlocks StagsHub for enrollment and login.
            </p>
            <form onSubmit={handleGateSubmit} className="list">
              <input
                className="input"
                type="password"
                placeholder="Secret key"
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
              />
              <button className="button" type="submit">
                Unlock
              </button>
            </form>
          </div>
          <div className="card">
            <h2 className="card-title">What happens next?</h2>
            <p className="card-sub">
              Once the key is verified, users can enroll and log in to manage shared sections.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="list-item">
                <span>Enroll or log in</span>
                <span className="badge">Step 1</span>
              </div>
              <div className="list-item">
                <span>Create sections together</span>
                <span className="badge">Step 2</span>
              </div>
              <div className="list-item">
                <span>Add cards with names</span>
                <span className="badge">Step 3</span>
              </div>
            </div>
          </div>
        </div>
      ) : !me ? (
        <div className="grid grid-2 fade-in">
          <div className="card">
            <div className="tabs">
              <button
                className={`tab ${authMode === "enroll" ? "active" : ""}`}
                onClick={() => setAuthMode("enroll")}
              >
                Enroll
              </button>
              <button
                className={`tab ${authMode === "login" ? "active" : ""}`}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
            </div>
            <h2 className="card-title">
              {authMode === "enroll" ? "Enroll as a new user" : "Welcome back"}
            </h2>
            <p className="card-sub">
              Use the same secret key each time before enrolling or logging in.
            </p>
            <form onSubmit={handleAuth} className="list">
              <input
                className="input"
                placeholder="Your name"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
              />
              <input
                className="input"
                type="password"
                placeholder="Password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
              />
              <button className="button" type="submit">
                {authMode === "enroll" ? "Enroll & Login" : "Login"}
              </button>
            </form>
          </div>
          <div className="card">
            <h2 className="card-title">Shared visibility</h2>
            <p className="card-sub">
              Every enrolled user appears in the roster. Sections and cards are shared across everyone.
            </p>
            <div className="list">
              <div className="list-item">
                <span>Users roster</span>
                <span className="badge">Live</span>
              </div>
              <div className="list-item">
                <span>Custom sections</span>
                <span className="badge">Global</span>
              </div>
              <div className="list-item">
                <span>Card lists by user</span>
                <span className="badge">Shared</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid fade-in">
          {/* Tabs were here, replaced by bottom nav */}

          {activeTab === "users" && (
            <div className="flex-column fade-in">
              <div className="card" style={{ marginBottom: "20px" }}>
                <input
                  className="input"
                  placeholder="Search user name to find friends"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  style={{ marginBottom: '6px' }}
                />
              </div>

              {users
                .filter(u => {
                  if (u.id === me.id) return false;
                  const matchesSearch = u.displayName.toLowerCase().includes(userSearchQuery.toLowerCase());
                  if (userSearchQuery.trim() === "") {
                    // Only show existing friends and pending requests when not searching
                    return friends.some(f => f.id === u.id) || incomingRequests.some(r => r.id === u.id) || outgoingRequests.some(r => r.id === u.id);
                  }
                  return matchesSearch;
                })
                .map((user) => {
                  const isFriend = friends.some(f => f.id === user.id);
                  const isIncoming = incomingRequests.some(r => r.id === user.id);
                  const isOutgoing = outgoingRequests.some(r => r.id === user.id);
                  return (
                    <div key={user.id} className="user-list-item">
                      <div className="user-info">
                        <div className="avatar-circle">
                          {user.displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <strong>{user.displayName}</strong>
                          <div className="footer-note">@{user.name}</div>
                        </div>
                      </div>
                      <div className="user-actions">
                        {isFriend ? (
                          <>
                            <button className="btn-outline" onClick={() => handleUnfriend(user.id)} style={{ border: 'none', color: 'var(--muted)' }}>
                              unfriend
                            </button>
                            {invitingUserId === user.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', minWidth: '200px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', alignSelf: 'flex-start' }}>
                                  Invite to group
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                  {groups.filter(g => g.adminIds?.includes(me?.id ?? '')).map(g => (
                                    <button
                                      key={g.id}
                                      type="button"
                                      onClick={() => setInviteTargetGroupId(g.id)}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '8px 12px',
                                        background: inviteTargetGroupId === g.id ? 'var(--glow-1)' : 'var(--bg-2)',
                                        border: `1.5px solid ${inviteTargetGroupId === g.id ? 'var(--accent)' : 'var(--border)'}`,
                                        borderRadius: '10px', cursor: 'pointer',
                                        color: inviteTargetGroupId === g.id ? 'var(--accent)' : 'var(--text)',
                                        fontWeight: 600, fontSize: '0.875rem',
                                        transition: 'all 0.15s', textAlign: 'left', width: '100%'
                                      }}
                                    >
                                      <div style={{
                                        width: '26px', height: '26px', borderRadius: '7px',
                                        background: inviteTargetGroupId === g.id ? 'var(--accent)' : 'var(--border)',
                                        color: inviteTargetGroupId === g.id ? '#fff' : 'var(--muted)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
                                      }}>
                                        {g.name.slice(0, 1).toUpperCase()}
                                      </div>
                                      {g.name}
                                      {inviteTargetGroupId === g.id && <span style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>✓</span>}
                                    </button>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                                  <button type="button" className="action-btn action-btn-secondary" style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => { setInvitingUserId(null); setInviteTargetGroupId(''); }}>
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="action-btn action-btn-primary"
                                    style={{ flex: 2, padding: '6px 10px', fontSize: '0.8rem' }}
                                    disabled={!inviteTargetGroupId}
                                    onClick={async () => {
                                      if (!inviteTargetGroupId) return;
                                      setNotice(null);
                                      try {
                                        await api(`/api/groups/${inviteTargetGroupId}/invite`, {
                                          method: "POST",
                                          body: JSON.stringify({ userId: user.id }),
                                        });
                                        setInvitingUserId(null);
                                        setInviteTargetGroupId("");
                                        setNotice("Invite sent successfully!");
                                        await loadGroups();
                                      } catch (error) {
                                        setNotice((error as Error).message);
                                      }
                                    }}
                                  >
                                    Send Invite
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button className="btn-outline" onClick={() => {
                                const adminGroups = groups.filter(g => g.adminId === me?.id);
                                if (adminGroups.length === 0) {
                                  setNotice("You have no groups to invite them to.");
                                  return;
                                }
                                setInvitingUserId(user.id);
                              }}>
                                Invite to Group
                              </button>
                            )}
                          </>
                        ) : isIncoming ? (
                          <>
                            <button className="btn-outline" onClick={() => handleAcceptRequest(user.id)} style={{ border: 'none', background: 'var(--accent)', color: 'var(--bg)' }}>
                              accept
                            </button>
                            <button className="btn-outline" onClick={() => handleDeclineOrCancelRequest(user.id)} style={{ border: 'none', color: 'var(--muted)' }}>
                              decline
                            </button>
                          </>
                        ) : isOutgoing ? (
                          <button className="btn-outline" onClick={() => handleDeclineOrCancelRequest(user.id)} style={{ border: 'none', color: 'var(--muted)' }}>
                            cancel req
                          </button>
                        ) : (
                          <button className="btn-outline" onClick={() => handleSendFriendRequest(user.id)}>
                            send req
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Global Sections view removed as per refinement */}

          {activeTab === "groups" && (
            <div className="flex-column fade-in">
              {!selectedGroup ? (
                <>
                  <div className="card" style={{ marginBottom: "20px" }}>
                    <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: '10px' }}>
                      <input
                        className="input"
                        placeholder="Create group"
                        value={newGroupName}
                        onChange={(event) => setNewGroupName(event.target.value)}
                        style={{ background: 'transparent', borderBottom: '1px solid var(--border)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}
                      />
                      <button className="btn-outline" style={{ border: 'none' }} type="submit">
                        Add
                      </button>
                    </form>
                  </div>

                  <div className="flex-column" style={{ gap: '12px' }}>
                    {groups.map((group) => (
                      <div key={group.id} className="user-list-item" style={{ cursor: 'pointer', borderRadius: '8px' }} onClick={() => handleSelectGroup(group.id)}>
                        <div className="user-info">
                          <div className="avatar-circle">
                            {group.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '1.1rem' }}>
                            {group.name}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : !selectedSection ? (
                <>
                  {/* Group header: back + name + 3-dot menu in same row */}
                  <div className="group-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <button className="gh-back-btn" onClick={() => { handleSelectGroup(null); setGroupSubScreen(null); setShowGroupMenu(false); }}>
                        ← Back
                      </button>
                      <div className="avatar-circle" style={{ width: '44px', height: '44px', fontSize: '1.1rem', flexShrink: 0 }}>
                        {selectedGroup.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{selectedGroup.name}</div>
                        {selectedGroup.description && <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>{selectedGroup.description}</div>}
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <button className="gh-dots-btn" onClick={() => setShowGroupMenu(!showGroupMenu)}>⋮</button>
                      {showGroupMenu && (
                        <div className="gh-dropdown" onClick={() => setShowGroupMenu(false)}>
                          <button className="gh-menu-item" onClick={() => setGroupSubScreen('create-section')}>
                            <span>＋</span> Create Section
                          </button>
                          <button className="gh-menu-item" onClick={() => { loadGroupActivity(selectedGroupId!); setGroupSubScreen('activity'); }}>
                            <span>📋</span> Activity Feed
                          </button>
                          {selectedGroup.adminIds?.includes(me?.id ?? '') && (
                            <button className="gh-menu-item" onClick={() => setGroupSubScreen('invite')}>
                              <span>✉</span> Invite Friends
                            </button>
                          )}
                          {selectedGroup.adminIds?.includes(me?.id ?? '') && (
                            <button className="gh-menu-item" onClick={handleOpenSettings}>
                              <span>⚙</span> Settings
                            </button>
                          )}
                          <div className="gh-menu-divider" />
                          <button className="gh-menu-item gh-menu-danger" onClick={() => handleRemoveMember(selectedGroup.id, me.id)}>
                            <span>↩</span> Leave Group
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sub-screens */}
                  {groupSubScreen === 'create-section' && (
                    <div className="sub-screen-panel fade-in">
                      <div className="sub-screen-header">
                        <h3>Create Section</h3>
                        <button className="gh-back-btn" onClick={() => setGroupSubScreen(null)}>✕</button>
                      </div>
                      <form onSubmit={async (e) => { await handleAddSection(e); setGroupSubScreen(null); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <input
                          className="input"
                          placeholder="Section name"
                          value={newSectionName}
                          onChange={(e) => setNewSectionName(e.target.value)}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="button" className="action-btn action-btn-secondary" style={{ flex: 1 }} onClick={() => setGroupSubScreen(null)}>Cancel</button>
                          <button type="submit" className="action-btn action-btn-primary" style={{ flex: 2 }}>Create Section</button>
                        </div>
                      </form>
                    </div>
                  )}

                  {groupSubScreen === 'invite' && selectedGroup.adminIds?.includes(me?.id ?? '') && (
                    <div className="sub-screen-panel fade-in">
                      <div className="sub-screen-header">
                        <h3>Invite Friends</h3>
                        <button className="gh-back-btn" onClick={() => setGroupSubScreen(null)}>✕</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {(() => {
                          const invitableFriends = friends.filter(f => !selectedGroup.memberIds.includes(f.id));
                          return invitableFriends.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>
                              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>👥</div>
                              <div style={{ fontWeight: 500 }}>All your friends are already in this group</div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {invitableFriends.map(f => (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => setGroupMemberToAdd(f.id)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '10px 14px',
                                    background: groupMemberToAdd === f.id ? 'var(--glow-1)' : 'var(--bg-2)',
                                    border: `1.5px solid ${groupMemberToAdd === f.id ? 'var(--accent)' : 'var(--border)'}`,
                                    borderRadius: '12px', cursor: 'pointer',
                                    transition: 'all 0.15s', textAlign: 'left', width: '100%'
                                  }}
                                >
                                  <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: groupMemberToAdd === f.id ? 'var(--accent)' : 'var(--border)',
                                    color: groupMemberToAdd === f.id ? '#fff' : 'var(--muted)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.9rem', fontWeight: 700, flexShrink: 0
                                  }}>
                                    {f.displayName.slice(0, 1).toUpperCase()}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: groupMemberToAdd === f.id ? 'var(--accent)' : 'var(--text)' }}>{f.displayName}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>@{f.name}</div>
                                  </div>
                                  {groupMemberToAdd === f.id && (
                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0 }}>✓</div>
                                  )}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="button" className="action-btn action-btn-secondary" style={{ flex: 1 }} onClick={() => { setGroupSubScreen(null); setGroupMemberToAdd(''); }}>Cancel</button>
                          <button
                            type="button"
                            className="action-btn action-btn-primary"
                            style={{ flex: 2 }}
                            disabled={!groupMemberToAdd}
                            onClick={async () => {
                              if (!selectedGroupId || !groupMemberToAdd) return;
                              setNotice(null);
                              try {
                                await api(`/api/groups/${selectedGroupId}/invite`, {
                                  method: "POST",
                                  body: JSON.stringify({ userId: groupMemberToAdd }),
                                });
                                setGroupMemberToAdd("");
                                setGroupSubScreen(null);
                                await loadGroups();
                                setNotice("Invite sent!");
                              } catch (error) {
                                setNotice((error as Error).message);
                              }
                            }}
                          >
                            Send Invite
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {groupSubScreen === 'activity' && (
                    <div className="sub-screen-panel fade-in">
                      <div className="sub-screen-header">
                        <h3>📋 Activity Feed</h3>
                        <button className="gh-back-btn" onClick={() => setGroupSubScreen(null)}>✕</button>
                      </div>
                      {groupActivity.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '28px 0' }}>
                          <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🌱</div>
                          <div style={{ fontWeight: 500 }}>No activity yet. Be the first!</div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                          {groupActivity.map((event, idx) => {
                            const ICONS: Record<string, string> = { item_added: '📝', member_joined: '👋', member_promoted: '⚡', section_created: '📁' };
                            return (
                              <div key={event.id} style={{ display: 'flex', gap: '12px', padding: '12px 4px', borderBottom: idx < groupActivity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--glow-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                                  {ICONS[event.type] ?? '📣'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{event.detail}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '3px' }}>
                                    {new Date(event.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {groupSubScreen === 'settings' && selectedGroup.adminIds?.includes(me?.id ?? '') && (
                    <div className="sub-screen-panel fade-in">
                      <div className="sub-screen-header">
                        <h3>Group Settings</h3>
                        <button className="gh-back-btn" onClick={() => setGroupSubScreen(null)}>✕</button>
                      </div>

                      {/* Invite Link */}
                      <div style={{ marginBottom: '24px' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>Invite Link</label>
                        {groupInviteToken ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              className="input"
                              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/invite/${groupInviteToken}`}
                              readOnly
                              style={{ fontSize: '0.8rem' }}
                            />
                            <button type="button" className="action-btn action-btn-primary" style={{ flexShrink: 0, padding: '8px 14px' }} onClick={handleCopyInviteLink}>
                              {inviteLinkCopied ? '✓ Copied!' : 'Copy'}
                            </button>
                          </div>
                        ) : (
                          <button type="button" className="action-btn action-btn-secondary" style={{ width: '100%' }} onClick={() => handleGetInviteLink(selectedGroupId!)}>
                            Generate Invite Link
                          </button>
                        )}
                      </div>

                      <form onSubmit={handleSaveGroupSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Group Description</label>
                        <textarea
                          className="input"
                          placeholder="Add a short description for this group…"
                          value={groupDescription}
                          onChange={(e) => setGroupDescription(e.target.value)}
                          rows={3}
                          style={{ resize: 'vertical' }}
                        />
                        <button type="submit" className="action-btn action-btn-primary">Save Changes</button>
                      </form>

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '14px' }}>Members</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {groupSettingsMembers.map(member => {
                            const isOriginalAdmin = selectedGroup.adminId === member.id;
                            const canKick = !isOriginalAdmin && (me?.id === selectedGroup.adminId || !member.isAdmin);
                            const canPromote = !member.isAdmin;
                            return (
                              <div key={member.id} className="member-settings-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                  <div className="avatar-circle" style={{ width: '36px', height: '36px', fontSize: '0.9rem', flexShrink: 0 }}>
                                    {member.displayName.slice(0, 1).toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{member.displayName}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                      {isOriginalAdmin ? '👑 Owner' : member.isAdmin ? '⚡ Admin' : '@' + member.name}
                                    </div>
                                  </div>
                                </div>
                                {member.id !== me?.id && (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    {canPromote && (
                                      <button className="action-btn action-btn-secondary" style={{ padding: '5px 12px', fontSize: '0.78rem' }} onClick={() => handlePromoteToAdmin(member.id)}>
                                        Make Admin
                                      </button>
                                    )}
                                    {canKick && (
                                      <button className="action-btn action-btn-danger" style={{ padding: '5px 12px', fontSize: '0.78rem' }} onClick={() => handleKickMember(member.id)}>
                                        Kick
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sections list */}
                  {!groupSubScreen && (
                    <div className="flex-column" style={{ gap: '8px', marginTop: '8px' }}>
                      {sections.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 20px' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📂</div>
                          <div style={{ fontWeight: 500 }}>No sections yet</div>
                          <div style={{ fontSize: '0.875rem', marginTop: '6px' }}>Use the ⋮ menu to create a section</div>
                        </div>
                      )}
                      {sections.map((section) => (
                        <div key={section.id} className="section-row" onClick={() => handleSelectSection(section.id)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            <div className="section-icon">§</div>
                            <span style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{section.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {selectedGroup.adminIds?.includes(me?.id ?? '') && (
                              <button
                                type="button"
                                className="action-btn action-btn-ghost-danger"
                                onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }}
                              >
                                Delete
                              </button>
                            )}
                            <span style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>›</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Section view: back + section name in header */}
                  <div className="group-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button className="gh-back-btn" onClick={() => handleSelectSection(null)}>← Back</button>
                      <div className="section-icon">§</div>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{selectedSection.name}</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        className="input"
                        placeholder="Add an item to this section…"
                        value={newItemLabel}
                        onChange={(event) => setNewItemLabel(event.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button className="action-btn action-btn-primary" type="submit" style={{ whiteSpace: 'nowrap' }}>Add Item</button>
                    </form>
                  </div>

                  <div className="flex-column" style={{ gap: '10px' }}>
                    {items.length === 0 && (
                      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 20px' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📝</div>
                        <div style={{ fontWeight: 500 }}>No items yet</div>
                        <div style={{ fontSize: '0.875rem', marginTop: '6px' }}>Be the first to add something</div>
                      </div>
                    )}
                    {items.map((item) => {
                      const isOwner = item.userId === me?.id;
                      const isGroupAdmin = selectedGroup?.adminIds?.includes(me?.id ?? '');
                      const canDelete = isOwner || me?.isAdmin || isGroupAdmin;
                      const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
                        'open': { bg: 'rgba(100,116,139,0.15)', color: 'var(--muted)', label: 'Open' },
                        'in-progress': { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'In Progress' },
                        'done': { bg: 'rgba(52,211,153,0.15)', color: '#34d399', label: 'Done' },
                      };
                      const st = STATUS_STYLE[item.status ?? 'open'];
                      const EMOJIS = ['👍', '❤️', '🔥', '😂', '😮'];
                      return (
                        <div key={item.id} className="item-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            {/* Status badge hidden for now — logic preserved, re-enable by changing false to (canDelete || isOwner) */}
                            {false && (canDelete || isOwner) && (
                              <button
                                type="button"
                                onClick={() => cycleItemStatus(item.id, item.status ?? 'open')}
                                style={{
                                  background: st.bg, color: st.color,
                                  border: 'none', borderRadius: '7px',
                                  padding: '4px 9px', fontSize: '0.72rem', fontWeight: 700,
                                  cursor: 'pointer', flexShrink: 0, marginTop: '2px',
                                  letterSpacing: '0.02em',
                                }}
                                title="Click to change status"
                              >
                                {st.label}
                              </button>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 500, color: 'var(--text)', wordBreak: 'break-word' }}>
                                {item.pinned && <span style={{ marginRight: '6px', fontSize: '0.85rem' }}>📌</span>}
                                {item.label}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '3px' }}>by {item.userName}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              {/* Pin button for admins */}
                              {isGroupAdmin && (
                                <button
                                  type="button"
                                  onClick={() => toggleItemPin(item.id, item.pinned)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', opacity: item.pinned ? 1 : 0.4, padding: '4px' }}
                                  title={item.pinned ? 'Unpin' : 'Pin to top'}
                                >
                                  📌
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  className="action-btn action-btn-ghost-danger"
                                  style={{ flexShrink: 0, padding: '4px 10px', fontSize: '0.8rem' }}
                                  onClick={() => handleDeleteItem(item.id)}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Reactions bar */}
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {EMOJIS.map((emoji) => {
                              const reaction = item.reactions?.find((r) => r.emoji === emoji);
                              const hasReacted = reaction?.userIds?.includes(me?.id ?? '');
                              const count = reaction?.userIds?.length ?? 0;
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => toggleReaction(item.id, emoji)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    background: hasReacted ? 'var(--glow-1)' : 'rgba(255,255,255,0.04)',
                                    border: `1.5px solid ${hasReacted ? 'var(--accent)' : 'var(--border)'}`,
                                    borderRadius: '8px', padding: '3px 8px',
                                    fontSize: '0.85rem', cursor: 'pointer',
                                    color: hasReacted ? 'var(--accent)' : 'var(--muted)',
                                    fontWeight: hasReacted ? 700 : 400,
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  {emoji}
                                  {count > 0 && <span style={{ fontSize: '0.75rem' }}>{count}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "profile" && (
            <div className="flex-column fade-in text-center" style={{ marginTop: '32px', gap: '0' }}>
              <div className="avatar-circle avatar-large">
                {me.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div style={{
                marginBottom: '36px',
                fontSize: '1.5rem',
                fontWeight: '800',
                letterSpacing: '-0.03em',
                background: 'var(--grad-accent)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {me.displayName}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '-30px', marginBottom: '32px' }}>@{me.name}</div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '48px', marginBottom: '48px' }}>
                <div className="stat-item">
                  <span className="stat-value">{groups.filter(g => g.memberIds.includes(me.id)).length.toString().padStart(2, '0')}</span>
                  <span className="stat-label">Groups</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{friends.length.toString().padStart(2, '0')}</span>
                  <span className="stat-label">Friends</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%', maxWidth: '320px', margin: '0 auto' }}>
                <form onSubmit={handleUpdateName} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                  <input
                    className="input text-center"
                    placeholder="New display name"
                    value={profileNameInput}
                    onChange={(event) => setProfileNameInput(event.target.value)}
                  />
                  <button className="action-btn action-btn-primary" type="submit">
                    Update Name
                  </button>
                </form>

                {showPasswordChange ? (
                  <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                    <input
                      className="input text-center"
                      type="password"
                      placeholder="New password"
                      value={newPasswordInput}
                      onChange={(event) => setNewPasswordInput(event.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                      <button className="action-btn action-btn-secondary" style={{ flex: 1 }} type="button" onClick={() => setShowPasswordChange(false)}>
                        Cancel
                      </button>
                      <button className="action-btn action-btn-primary" style={{ flex: 1 }} type="submit">
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <button className="action-btn action-btn-secondary" style={{ width: '100%' }} onClick={() => setShowPasswordChange(true)}>
                    Change Password
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {me && (
        <nav className="bottom-nav">
          <button
            className={`bottom-nav-item ${activeTab === "users" ? "active" : ""}`}
            onClick={() => { setActiveTab("users"); setNotice(null); }}
          >
            Users
          </button>
          <button
            className={`bottom-nav-item ${activeTab === "groups" ? "active" : ""}`}
            onClick={() => { setActiveTab("groups"); setNotice(null); }}
          >
            Groups
          </button>
          <button
            className={`bottom-nav-item ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => { setActiveTab("profile"); setNotice(null); }}
          >
            Profile
          </button>
        </nav>
      )}
    </div>
  );
}
