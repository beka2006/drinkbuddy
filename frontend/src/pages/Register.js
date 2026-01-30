import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../api/auth";

export default function Register() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password.");
      return;
    }

    try {
      setLoading(true);
      await register(username.trim(), password);
      nav("/login");
    } catch (e) {
      setError(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px" }}>
      <h1 style={{ marginTop: 0 }}>Register</h1>

      <form onSubmit={onSubmit} style={{ border: "1px solid #333", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
          />

          <button disabled={loading} type="submit">
            {loading ? "Creating..." : "Create account"}
          </button>

          {error && <div style={{ color: "crimson" }}>{error}</div>}
        </div>
      </form>

      <div style={{ marginTop: 12 }}>
        Already have an account? <Link to="/login">Login</Link>
      </div>
    </div>
  );
}
