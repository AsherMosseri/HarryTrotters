import { useState } from 'react';
import { ADMIN_EMAILS } from '../config.js';
import { Avatar } from './common.jsx';

export default function TeamView({ store, members, roster, fail }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const sorted = [...members].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const withAccess = new Set(members.map((m) => m.name));
  const missing = roster.filter((n) => !withAccess.has(n));

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) return;
    try {
      await store.addMember(email, name);
      setName('');
      setEmail('');
    } catch (err) {
      fail(err);
    }
  };

  return (
    <main className="content team">
      <section className="team-card">
        <h2>Add a teammate</h2>
        <p className="muted small">Only people on this list can sign in and see tasks. Use the Google account they'll sign in with.</p>
        <form className="team-form" onSubmit={add}>
          <input className="input" list="roster-names" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <datalist id="roster-names">
            {missing.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="their.email@gmail.com"
          />
          <button className="btn primary" disabled={!name.trim() || !email.trim()}>
            Add
          </button>
        </form>
        {missing.length > 0 && (
          <p className="muted small">
            Still need access:{' '}
            {missing.map((n, i) => (
              <button key={n} className="link-btn" onClick={() => setName(n)}>
                {n}
                {i < missing.length - 1 ? ',' : ''}
              </button>
            ))}
          </p>
        )}
      </section>

      <section className="team-card">
        <h2>Team ({sorted.length})</h2>
        <ul className="member-list">
          {sorted.map((m) => (
            <li key={m.id}>
              <Avatar name={m.name} size={32} />
              <div className="grow">
                <div>
                  {m.name} {ADMIN_EMAILS.includes(m.id) && <span className="tag">Admin</span>}
                </div>
                <div className="muted small">{m.email}</div>
              </div>
              {!ADMIN_EMAILS.includes(m.id) && (
                <button
                  className="link-btn danger"
                  onClick={() => confirm(`Remove ${m.name}'s access?`) && store.removeMember(m.id).catch(fail)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
          {!sorted.length && <li className="muted">No one added yet. Add yourself too so your name shows correctly.</li>}
        </ul>
      </section>
    </main>
  );
}
