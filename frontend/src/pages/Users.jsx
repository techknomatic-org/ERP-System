import React, { useEffect, useState } from 'react';
import { Users as UsersIcon, UserPlus, Shield, CheckCircle, XCircle, Key, Edit, RefreshCw } from 'lucide-react';
import { authService } from '../services/api';
import { ALL_ROLES } from '../config/roles';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Form State
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'site_engineer',
    password: ''
  });
  const [resetPassword, setResetPassword] = useState('');

  const loadUsers = () => {
    setLoading(true);
    authService.getUsers()
      .then(res => setUsers(res.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = (e) => {
    e.preventDefault();
    authService.register(formData)
      .then(() => {
        alert("User account created successfully!");
        setShowCreateModal(false);
        setFormData({ username: '', email: '', full_name: '', role: 'site_engineer', password: '' });
        loadUsers();
      })
      .catch(err => alert("Error creating user: " + (err.response?.data?.detail || err.message)));
  };

  const handleUpdateUser = (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    authService.updateUserProfile(selectedUser.id, {
      full_name: formData.full_name,
      email: formData.email,
      role: formData.role
    })
      .then(() => {
        alert("User account updated successfully!");
        setShowEditModal(false);
        setSelectedUser(null);
        loadUsers();
      })
      .catch(err => alert("Error updating user: " + (err.response?.data?.detail || err.message)));
  };

  const handleToggleStatus = (userId, currentStatus) => {
    const actionStr = currentStatus ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${actionStr} this user account?`)) return;

    authService.toggleUserStatus(userId)
      .then(() => {
        loadUsers();
      })
      .catch(err => alert("Error updating status: " + (err.response?.data?.detail || err.message)));
  };

  const handleResetPasswordSubmit = (e) => {
    e.preventDefault();
    if (!selectedUser || !resetPassword) return;

    authService.resetUserPassword(selectedUser.id, resetPassword)
      .then(() => {
        alert(`Password for ${selectedUser.username} reset successfully!`);
        setShowResetModal(false);
        setResetPassword('');
        setSelectedUser(null);
      })
      .catch(err => alert("Error resetting password: " + (err.response?.data?.detail || err.message)));
  };

  const openEditModal = (u) => {
    setSelectedUser(u);
    setFormData({
      username: u.username,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      password: ''
    });
    setShowEditModal(true);
  };

  const openResetModal = (u) => {
    setSelectedUser(u);
    setResetPassword('');
    setShowResetModal(true);
  };

  return (
    <div className="content-page">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">User Account & Role Management</h1>
          <p className="page-subtitle">Manage system users, assign RBAC permissions, reset passwords, and toggle active status</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={loadUsers}>
            <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <UserPlus size={16} /> Create User Account
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Full Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Assigned Role</th>
              <th>Account Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem' }}>
                  {loading ? "Loading users from database..." : "No user accounts registered."}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600, color: '#818cf8' }}>#{u.id}</td>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>{u.full_name}</td>
                  <td style={{ color: '#cbd5e1' }}>{u.username}</td>
                  <td style={{ color: '#38bdf8', fontSize: '0.85rem' }}>{u.email}</td>
                  <td>
                    <span className={`tag-badge ${
                      u.role === 'admin' ? 'tag-danger' :
                      u.role === 'customer' ? 'tag-success' : 'tag-info'
                    }`}>
                      {u.role ? u.role.replace('_', ' ').toUpperCase() : 'USER'}
                    </span>
                  </td>
                  <td>
                    {u.is_active ? (
                      <span className="tag-badge tag-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <CheckCircle size={12} /> Active
                      </span>
                    ) : (
                      <span className="tag-badge tag-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <XCircle size={12} /> Deactivated
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => openEditModal(u)}
                      >
                        <Edit size={12} /> Edit
                      </button>

                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => openResetModal(u)}
                      >
                        <Key size={12} /> Key
                      </button>

                      <button
                        className={`btn ${u.is_active ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: u.is_active ? '#f43f5e' : '#10b981' }}
                        onClick={() => handleToggleStatus(u.id, u.is_active)}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-card" style={{ width: '440px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Create System User Account</h3>
            <form onSubmit={handleCreateUser}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Username</label>
                <input required type="text" className="form-control" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Full Name</label>
                <input required type="text" className="form-control" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Email Address</label>
                <input required type="email" className="form-control" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Assign Application Role</label>
                <select className="form-control" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                  {ALL_ROLES.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Initial Password</label>
                <input required type="password" className="form-control" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-card" style={{ width: '440px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Edit User Account: {selectedUser.username}</h3>
            <form onSubmit={handleUpdateUser}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Full Name</label>
                <input required type="text" className="form-control" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Email Address</label>
                <input required type="email" className="form-control" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Assign Application Role</label>
                <select className="form-control" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                  {ALL_ROLES.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-card" style={{ width: '400px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1rem' }}>Reset Password for {selectedUser.username}</h3>
            <form onSubmit={handleResetPasswordSubmit}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>New Password</label>
                <input required type="password" className="form-control" placeholder="Enter new password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowResetModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#f43f5e', borderColor: '#e11d48' }}>Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
