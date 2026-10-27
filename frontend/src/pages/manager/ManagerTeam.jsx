import React, { useEffect, useState } from "react";
import { getTesters, createTester, toggleTesterStatus, deleteTester } from "../../services/teamService";
import { Icon } from "../../components/common/Icons";
import { Modal } from "../../components/common/Modal";
import { ConfirmModal } from "../../components/common/ConfirmModal";
import { useToast } from "../../context/ToastContext";

export function ManagerTeam() {
  const [testers, setTesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [testerName, setTesterName] = useState("");
  const [testerEmail, setTesterEmail] = useState("");
  const [testerPassword, setTesterPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { addToast } = useToast();

  const loadTesters = async () => {
    try {
      setLoading(true);
      const data = await getTesters();
      setTesters(Array.isArray(data) ? data : []);
    } catch {
      addToast("Failed to fetch testers roster.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTesters();
  }, []);

  const handleCreateTester = async (e) => {
    e.preventDefault();
    if (!testerName.trim() || !testerEmail.trim() || !testerPassword) {
      addToast("Please fill in all required fields.", "error");
      return;
    }

    if (testerPassword.length < 8) {
      addToast("Password must be at least 8 characters.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await createTester({
        name: testerName.trim(),
        email: testerEmail.trim().toLowerCase(),
        password: testerPassword,
      });

      addToast("QA Tester successfully onboarded!", "success");
      setTesterName("");
      setTesterEmail("");
      setTesterPassword("");
      setShowPassword(false);
      setIsModalOpen(false);
      await loadTesters();
    } catch (err) {
      addToast(err.response?.data?.detail || "Could not create tester account.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (testerId) => {
    try {
      const res = await toggleTesterStatus(testerId);
      addToast(res.message || "Tester status updated.", "success");
      setTesters((prev) =>
        prev.map((t) => (t.id === testerId ? { ...t, is_active: res.is_active } : t))
      );
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to update tester status.", "error");
    }
  };

  const handleDeleteTester = (testerId, name) => {
    setDeleteTarget({ id: testerId, name });
  };

  const confirmDeleteTester = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteTester(deleteTarget.id);
      addToast(res.message || `Tester "${deleteTarget.name}" deleted.`, "success");
      setTesters((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to delete tester.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const filteredTesters = testers.filter(
    (t) =>
      (t.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title-box">
          <h1>QA Engineering Team</h1>
          <p className="page-subtitle">
            Manage your QA specialists, onboard new testers, and manage test team access.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Icon name="plus" size={16} />
          <span>Add Tester</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-search-container">
        <div className="search-input-wrapper">
          <span className="search-icon">
            <Icon name="search" size={16} />
          </span>
          <input
            type="text"
            className="search-input-field"
            placeholder="Search by tester name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filters-cluster">
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Showing <strong>{filteredTesters.length}</strong> of {testers.length} team members
          </span>
          {search && (
            <button className="btn btn-secondary btn-sm" onClick={() => setSearch("")}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Team Roster Grid */}
      {loading ? (
        <div className="empty-state-card">
          <p>Loading QA team members...</p>
        </div>
      ) : filteredTesters.length === 0 ? (
        <div className="card empty-state-card">
          <div className="empty-state-icon">
            <Icon name="team" size={28} />
          </div>
          <h3>{search ? "No matching testers found" : "No testers onboarded yet"}</h3>
          <p>
            {search
              ? "Try searching with a different name or email address."
              : "Add QA testers to your workspace so they can report bugs and submit sprint progress."}
          </p>
          {!search && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Icon name="plus" size={16} />
              <span>Add First Tester</span>
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
            gap: "1.5rem",
          }}
        >
          {filteredTesters.map((tester) => (
            <div
              key={tester.id}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                padding: "1.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "var(--radius-full)",
                    background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "1.2rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
                  }}
                >
                  {(tester.name || "T").charAt(0).toUpperCase()}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3
                    style={{
                      fontSize: "1.05rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {tester.name}
                  </h3>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {tester.email}
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: "0.95rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                }}
              >
                <button
                  onClick={() => handleToggleStatus(tester.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    color: tester.is_active !== false ? "var(--success)" : "var(--text-faint)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  title="Click to toggle active status"
                >
                  <span
                    className="pulse-indicator"
                    style={{
                      width: 6,
                      height: 6,
                      background: tester.is_active !== false ? "var(--success)" : "var(--text-faint)",
                    }}
                  />
                  {tester.is_active !== false ? "Active Tester" : "Inactive"}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-faint)",
                      background: "var(--bg-surface-elevated)",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    UID #{tester.id}
                  </span>

                  <button
                    onClick={() => handleDeleteTester(tester.id, tester.name)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      padding: "4px 6px",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "color 0.15s ease, background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#f43f5e";
                      e.currentTarget.style.background = "rgba(244, 63, 94, 0.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-muted)";
                      e.currentTarget.style.background = "transparent";
                    }}
                    title="Delete tester"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Tester */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setShowPassword(false);
        }}
        title="Onboard QA Tester"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setIsModalOpen(false);
                setShowPassword(false);
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateTester}
              disabled={submitting}
            >
              {submitting ? "Adding..." : "Onboard Tester"}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateTester} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="form-group-block">
            <label htmlFor="test-name">Full Name *</label>
            <input
              id="test-name"
              type="text"
              placeholder="e.g. Sarah Jenkins"
              value={testerName}
              onChange={(e) => setTesterName(e.target.value)}
              required
            />
          </div>

          <div className="form-group-block">
            <label htmlFor="test-email">Work Email *</label>
            <input
              id="test-email"
              type="email"
              placeholder="s.jenkins@company.com"
              value={testerEmail}
              onChange={(e) => setTesterEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group-block">
            <label htmlFor="test-pass">Temporary Password *</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%" }}>
              <input
                id="test-pass"
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 8 characters"
                minLength={8}
                value={testerPassword}
                onChange={(e) => setTesterPassword(e.target.value)}
                required
                style={{ paddingRight: "2.6rem", width: "100%" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  background: "transparent",
                  border: "none",
                  color: showPassword ? "var(--primary)" : "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                  borderRadius: "var(--radius-sm)",
                  transition: "color var(--transition-fast)",
                }}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
              </button>
            </div>
            <small style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>
              The tester will use this credential to log in to the Tester Portal.
            </small>
          </div>
        </form>
      </Modal>

      {/* User-friendly Alert / Confirmation Modal for Tester Deletion */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDeleteTester}
        title="Delete QA Tester?"
        message="Are you sure you want to delete this tester account from the QA engineering team?"
        itemName={deleteTarget ? `${deleteTarget.name} (ID: #${deleteTarget.id})` : ""}
        note="All assigned projects will be safely freed up and returned to the dashboard. Defect tickets and QA audit history are preserved."
        confirmText="Yes, Delete"
        cancelText="No, Cancel"
        loading={deleting}
      />
    </div>
  );
}

export default ManagerTeam;
