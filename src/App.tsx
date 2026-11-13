import { useEffect, useState } from "react";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { RouteGenerator } from "./components/RouteGenerator";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  if (document.documentElement.dataset.theme === "light") return "light";
  return "dark";
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#000000" : "#ffffff");
    try {
      localStorage.setItem("xroute-theme", theme);
    } catch {
      // Theme persistence is optional.
    }
  }, [theme]);

  return (
    <>
      <a className="skip-link" href="#generator">
        跳到配置生成器
      </a>
      <Header
        theme={theme}
        onToggleTheme={() =>
          setTheme((current) => (current === "dark" ? "light" : "dark"))
        }
      />
      <main>
        <Hero />
        <RouteGenerator />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
