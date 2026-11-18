import { render } from "solid-js/web";
import { OptionsApp } from "../../options/options-app.jsx";
import "../../styles/base.css";
import "../../options/options.css";

const root = document.getElementById("root");
if (root) render(() => <OptionsApp />, root);
