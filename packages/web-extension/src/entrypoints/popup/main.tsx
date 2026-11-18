import { render } from "solid-js/web";
import { PopupApp } from "../../popup/popup-app.jsx";
import "../../styles/base.css";
import "../../popup/popup.css";

const root = document.getElementById("root");
if (root) render(() => <PopupApp />, root);
