import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import Feed from "./pages/Feed";
import Login from "./pages/Login";
import Register from "./pages/Register";
import "./App.css";

function Navbar() {
  const location = useLocation();
  const onAuthPage = location.pathname === "/login" || location.pathname === "/register";

  const token = localStorage.getItem("token"); // adjust if you use a different key
  const isLoggedIn = Boolean(token);

  const handleLogout = () => {
    localStorage.removeItem("token");
    // optional: remove username/user too if you store it
    window.location.href = "/login";
  };

  return (
    <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top">
      <div className="container container-narrow py-2">
        <Link to="/" className="navbar-brand fw-bold">
          🍻 DrinkBuddy
        </Link>

        <div className="ms-auto d-flex gap-2">
          {!isLoggedIn && !onAuthPage && (
            <>
              <Link to="/login" className="btn btn-outline-primary">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}

          {isLoggedIn && (
            <button onClick={handleLogout} className="btn btn-outline-danger">
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="container container-narrow py-4">
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
