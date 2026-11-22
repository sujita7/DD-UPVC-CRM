import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#3978f6",
          colorInfo: "#3978f6",
          colorSuccess: "#17845b",
          colorWarning: "#b7791f",
          colorError: "#c2414b",
          colorBgBase: "#ffffff",
          colorBgContainer: "#ffffff",
          colorBorder: "#e6ebf2",
          colorText: "#182538",
          colorTextSecondary: "#718096",
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          borderRadius: 9,
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
