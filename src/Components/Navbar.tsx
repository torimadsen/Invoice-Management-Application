import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Outlet } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();
  const [section, setSection] = useState("create");

  return (
    <>
      <nav className="navbar navbar-expand-lg bg-body-tertiary">
        <div className="container-fluid">
          <a tabIndex={-1} className="navbar-brand user-select-none">
            Rokningar
          </a>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarSupportedContent"
            aria-controls="navbarSupportedContent"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarSupportedContent">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <a
                  role="button"
                  className={`nav-link user-select-none ${
                    section === "create" ? "active" : ""
                  }`}
                  aria-current="page"
                  onClick={() => {
                    navigate("/");
                    setSection("create");
                  }}
                >
                  Upprætta
                </a>
              </li>
              <li className="nav-item">
                <a
                  role="button"
                  className={`nav-link user-select-none ${
                    section === "manage" ? "active" : ""
                  }`}
                  onClick={() => {
                    navigate("/umsit");
                    setSection("manage");
                  }}
                >
                  Umsit
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <Outlet />
    </>
  );
}

export default Navbar;
