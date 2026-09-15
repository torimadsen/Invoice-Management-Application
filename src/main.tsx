import React from "react";
import ReactDOM from "react-dom/client";
import Navbar from "./Components/Navbar.tsx";
import InvoiceEditor from "./Components/InvoiceEditor.tsx";
import InvoiceManager from "./Components/InvoiceManager.tsx";
import Backup from "./utils/backup.tsx";
import "bootstrap/dist/css/bootstrap.css";

import { createBrowserRouter, RouterProvider } from "react-router-dom";

const router = createBrowserRouter([
  {
    element: <Navbar />,
    children: [
      {
        path: "/",
        element: <InvoiceEditor />,
      },
      {
        path: "/stovna/:id",
        element: <InvoiceEditor />,
      },
      {
        path: "/umsit",
        element: <InvoiceManager />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Backup />
    <RouterProvider router={router} />
  </React.StrictMode>,
);
