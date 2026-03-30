'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PocketBase from 'pocketbase';
import { AVATAR_STYLES, getAvatarSeed, getAvatarStyle, getAvatarUrl, saveAvatarPrefs } from '../lib/avatar';

const pb = new PocketBase('http://127.0.0.1:8090');

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(pb.authStore.model);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [avatarStyle, setAvatarStyle] = useState('adventurer');
  const [avatarSeed, setAvatarSeed] = useState('redbox-user');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const currentUser = pb.authStore.model;
    if (!currentUser) {
      router.push('/auth');
      return;
    }

    setUser(currentUser);
    setFirstName(currentUser.first_name || '');
    setLastName(currentUser.last_name || '');
    setAvatarStyle(getAvatarStyle(currentUser));
    setAvatarSeed(getAvatarSeed(currentUser));

    const unsubscribe = pb.authStore.onChange(() => {
      const updated = pb.authStore.model;
      setUser(updated);
      if (!updated) {
        router.push('/auth');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSave = async (e) => {
    e.preventDefault();

    if (!user?.id) {
      setMessage('Please login again.');
      return;
    }

    try {
      setLoadingProfile(true);
      const normalizedSeed = avatarSeed.trim() || getAvatarSeed(user);
      saveAvatarPrefs(user.id, avatarStyle, normalizedSeed);

      let updated;
      try {
        updated = await pb.collection('users').update(user.id, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          avatar_style: avatarStyle,
          avatar_seed: normalizedSeed,
        });
      } catch (err) {
        const errText = String(err?.message || '').toLowerCase();
        const missingAvatarField = errText.includes('avatar_style') || errText.includes('avatar_seed');
        if (!missingAvatarField) throw err;

        // Fallback for databases where avatar fields are not migrated yet.
        updated = await pb.collection('users').update(user.id, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        });

        updated = { ...updated, avatar_style: avatarStyle, avatar_seed: normalizedSeed };
      }

      pb.authStore.save(pb.authStore.token, updated);
      setUser(updated);
      setMessage('Profile updated successfully.');
    } catch (err) {
      console.error('Profile update failed:', err);
      setMessage('Failed to update profile.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!user?.id) {
      setMessage('Please login again.');
      return;
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setMessage('Please fill all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setMessage('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setMessage('New password and confirm password do not match.');
      return;
    }

    try {
      setLoadingPassword(true);

      await pb.collection('users').update(user.id, {
        oldPassword: currentPassword,
        password: newPassword,
        passwordConfirm: confirmNewPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setMessage('Password changed successfully.');
    } catch (err) {
      console.error('Password change failed:', err);
      setMessage('Failed to change password. Check current password and try again.');
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/auth');
  };

  if (!user) {
    return null;
  }

  const avatarUrl = getAvatarUrl(avatarStyle, avatarSeed);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Profile</h1>

        {message && <div style={styles.notice}>{message}</div>}

        <div style={styles.avatarSection}>
          <h2 style={styles.sectionTitle}>Generated Avatar</h2>
          <img src={avatarUrl} alt="Avatar preview" style={styles.avatarPreview} />

          <label style={styles.label}>Avatar Seed</label>
          <div style={styles.seedRow}>
            <input
              type="text"
              value={avatarSeed}
              onChange={(e) => setAvatarSeed(e.target.value)}
              style={styles.input}
              placeholder="Use name, email, or any text"
            />
            <button
              type="button"
              style={styles.secondaryMiniBtn}
              onClick={() => setAvatarSeed(crypto.randomUUID())}
            >
              Random
            </button>
          </div>

          <label style={styles.label}>Pick Style</label>
          <div style={styles.avatarGrid}>
            {AVATAR_STYLES.map((styleName) => (
              <button
                type="button"
                key={styleName}
                style={{
                  ...styles.avatarOption,
                  borderColor: avatarStyle === styleName ? '#e50914' : 'rgba(229,9,20,0.25)',
                }}
                onClick={() => setAvatarStyle(styleName)}
                title={styleName}
              >
                <img src={getAvatarUrl(styleName, avatarSeed)} alt={styleName} style={styles.avatarThumb} />
              </button>
            ))}
          </div>
        </div>

        <div style={styles.divider} />

        <form onSubmit={handleSave} style={styles.form}>
          <label style={styles.label}>First Name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>Last Name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>Email</label>
          <input type="email" value={user.email || ''} disabled style={styles.inputDisabled} />

          <button type="submit" style={styles.primaryBtn} disabled={loadingProfile}>
            {loadingProfile ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <div style={styles.divider} />

        <form onSubmit={handleChangePassword} style={styles.form}>
          <h2 style={styles.sectionTitle}>Change Password</h2>

          <label style={styles.label}>Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>Confirm New Password</label>
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            style={styles.input}
          />

          <button type="submit" style={styles.primaryBtn} disabled={loadingPassword}>
            {loadingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div style={styles.actions}>
          <button style={styles.secondaryBtn} onClick={() => router.push('/vaults')}>
            Back to Vaults
          </button>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'black',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    boxSizing: 'border-box',
    color: 'white',
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    background: '#1a1a1a',
    borderRadius: '14px',
    padding: '28px',
    boxShadow: '0 0 20px rgba(229,9,20,0.28)',
    border: '1px solid rgba(229,9,20,0.35)',
  },
  title: {
    fontFamily: "'Orbitron', sans-serif",
    color: '#e50914',
    margin: '0 0 20px 0',
    textAlign: 'center',
  },
  sectionTitle: {
    margin: '0 0 6px 0',
    color: '#e50914',
    fontSize: '18px',
    fontWeight: '700',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  avatarSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  avatarPreview: {
    width: '96px',
    height: '96px',
    borderRadius: '999px',
    border: '2px solid rgba(229,9,20,0.45)',
    background: '#0f0f0f',
    alignSelf: 'center',
  },
  seedRow: {
    display: 'flex',
    gap: '8px',
  },
  avatarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: '8px',
  },
  avatarOption: {
    border: '1px solid rgba(229,9,20,0.25)',
    borderRadius: '10px',
    background: '#101010',
    padding: '6px',
    cursor: 'pointer',
  },
  avatarThumb: {
    width: '100%',
    height: '48px',
    objectFit: 'cover',
    borderRadius: '8px',
  },
  divider: {
    height: '1px',
    background: 'rgba(229,9,20,0.25)',
    margin: '20px 0',
  },
  label: {
    fontSize: '13px',
    color: '#ccc',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(229,9,20,0.45)',
    background: '#111',
    color: 'white',
    fontSize: '14px',
  },
  inputDisabled: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #333',
    background: '#0e0e0e',
    color: '#999',
    fontSize: '14px',
  },
  primaryBtn: {
    marginTop: '10px',
    padding: '10px 14px',
    border: 'none',
    borderRadius: '999px',
    background: '#e50914',
    color: 'white',
    fontWeight: '700',
    cursor: 'pointer',
  },
  actions: {
    marginTop: '16px',
    display: 'flex',
    gap: '10px',
  },
  secondaryBtn: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '999px',
    border: '1px solid rgba(229,9,20,0.45)',
    background: '#161616',
    color: 'white',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryMiniBtn: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(229,9,20,0.45)',
    background: '#161616',
    color: 'white',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '999px',
    border: 'none',
    background: '#5a0a10',
    color: '#ffd7d9',
    fontWeight: '700',
    cursor: 'pointer',
  },
  notice: {
    marginBottom: '12px',
    padding: '10px 12px',
    borderRadius: '8px',
    background: '#202020',
    color: '#ffd7d9',
    textAlign: 'center',
    border: '1px solid rgba(229,9,20,0.35)',
  },
};
