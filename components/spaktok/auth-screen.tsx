"use client";

import React from "react"

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { APP_LOGO_URL, APP_NAME } from "@/lib/brand";

type AuthMode = "welcome" | "login" | "signup" | "phone";

interface AuthScreenProps {
  onComplete?: () => void;
}

/**
 * Genericize the credential/existence signal to avoid account enumeration,
 * while still surfacing actionable states (unconfirmed email, rate limits).
 */
function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "E-Mail-Adresse oder Passwort ist falsch.";
  }
  if (m.includes("email not confirmed")) {
    return "Deine E-Mail-Adresse wurde noch nicht bestätigt. Prüfe deinen Posteingang.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Diese E-Mail-Adresse ist bereits registriert. Melde dich stattdessen an.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Zu viele Versuche. Warte kurz und versuche es erneut.";
  }
  if (m.includes("password")) {
    return "Das Passwort ist zu schwach. Verwende mindestens 6 Zeichen.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "Das Format der E-Mail-Adresse ist ungültig.";
  }
  return "Die Aktion konnte nicht abgeschlossen werden. Versuche es erneut.";
}

export function AuthScreen({ onComplete }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("welcome");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
    phone: "",
    otp: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (mode === "phone") {
      setError("Die Anmeldung per Telefonnummer ist derzeit nicht verfügbar. Verwende deine E-Mail-Adresse.");
      return;
    }

    const email = formData.email.trim();
    const password = formData.password;

    if (!email || !password) {
      setError("Bitte gib deine E-Mail-Adresse und dein Passwort ein.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Das Passwort muss mindestens 6 Zeichen enthalten.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const username = formData.username.trim();
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, username }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Die Kontoerstellung ist fehlgeschlagen. Versuche es erneut.");
          return;
        }

        // Account is created pre-confirmed on the server — sign in right away.
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setInfoMessage("Konto erfolgreich erstellt! Melde dich an, um fortzufahren.");
          setMode("login");
          return;
        }

        onComplete?.();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(mapAuthError(signInError.message));
          return;
        }

        onComplete?.();
      }
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten. Versuche es erneut.");
    } finally {
      setIsLoading(false);
    }
  };

  const socialButtons = [
    { name: "Google", icon: "G", color: "bg-white text-black border border-border" },
    { name: "Apple", icon: "", color: "bg-black text-white" },
    { name: "X", icon: "X", color: "bg-black text-white" },
  ];

  return (
    <div className="h-full bg-background flex flex-col relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-primary/30 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-[#3155ff]/20 via-transparent to-transparent rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {mode === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-6"
            >
              {/* Logo */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", duration: 1 }}
  className="mb-8 h-28 w-28 overflow-hidden rounded-3xl bg-black shadow-2xl shadow-blue-600/30 ring-1 ring-blue-500/30"
  >
  <img src={APP_LOGO_URL} alt={`${APP_NAME} logo`} className="h-full w-full object-cover" />
  </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-bold bg-gradient-to-r from-primary via-purple-500 to-[#3155ff] bg-clip-text text-transparent"
              >
                SpakTail
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground text-center mt-3 max-w-xs"
              >
                Schließe dich Millionen von Creators an und entdecke eine Welt voller inspirierender Inhalte
              </motion.p>

              {/* Features */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center gap-8 mt-10"
              >
                {[
                  { icon: "🎬", label: "Reels" },
                  { icon: "📡", label: "Live" },
                  { icon: "💬", label: "Chats" },
                  { icon: "🛍️", label: "Shop" },
                ].map((feature) => (
                  <div key={feature.label} className="flex flex-col items-center gap-1">
                    <span className="text-2xl">{feature.icon}</span>
                    <span className="text-xs text-muted-foreground">{feature.label}</span>
                  </div>
                ))}
              </motion.div>

              {/* Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="w-full max-w-sm mt-12 space-y-3"
              >
                <Button
                  onClick={() => setMode("signup")}
                  className="w-full h-14 rounded-2xl text-lg font-semibold bg-gradient-to-r from-primary to-[#3155ff] hover:opacity-90"
                >
                  Neues Konto erstellen
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMode("login")}
                  className="w-full h-14 rounded-2xl text-lg font-semibold bg-transparent border-2"
                >
                  Anmelden
                </Button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-xs text-muted-foreground text-center mt-6 max-w-xs"
              >
                Mit der Fortsetzung stimmst du{" "}
                <span className="text-primary">Nutzungsbedingungen</span> und{" "}
                <span className="text-primary">Datenschutzrichtlinie</span>
              </motion.p>
            </motion.div>
          )}

          {(mode === "login" || mode === "signup") && (
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex-1 flex flex-col p-6"
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMode("welcome")}
                  className="rounded-full"
                >
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">
                    {mode === "login" ? "Willkommen zurück" : "Konto erstellen"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {mode === "login"
                      ? "Melde dich an, um fortzufahren"
                      : "Werde Teil der SpakTail-Community"}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4 flex-1">
                {mode === "signup" && (
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      placeholder="Benutzername"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      className="h-14 pr-12 rounded-2xl bg-muted/50 border-0 text-right"
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="E-Mail-Adresse"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="h-14 pr-12 rounded-2xl bg-muted/50 border-0 text-right"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Passwort"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="h-14 pr-12 pl-12 rounded-2xl bg-muted/50 border-0 text-right"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Eye className="w-5 h-5 text-muted-foreground" />
                    )}
                  </Button>
                </div>

                {mode === "login" && (
                  <div className="text-left">
                    <Button variant="link" className="text-primary p-0 h-auto">
                      Passwort vergessen?
                    </Button>
                  </div>
                )}

                {error && (
                  <p
                    role="alert"
                    className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3 text-right"
                  >
                    {error}
                  </p>
                )}
                {infoMessage && (
                  <p
                    role="status"
                    className="text-sm text-primary bg-primary/10 rounded-xl px-4 py-3 text-right"
                  >
                    {infoMessage}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 rounded-2xl text-lg font-semibold bg-gradient-to-r from-primary to-[#3155ff] hover:opacity-90"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : mode === "login" ? (
                    "Anmelden"
                  ) : (
                    "Konto erstellen"
                  )}
                </Button>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-sm text-muted-foreground">oder</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Social buttons */}
                <div className="flex justify-center gap-4">
                  {socialButtons.map((social) => (
                    <Button
                      key={social.name}
                      type="button"
                      variant="outline"
                      size="icon"
                      className={cn("w-14 h-14 rounded-2xl text-lg font-bold", social.color)}
                    >
                      {social.icon}
                    </Button>
                  ))}
                </div>

                {/* Phone login */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMode("phone")}
                  className="w-full h-12 rounded-2xl"
                >
                  <Phone className="w-4 h-4 ml-2" />
                  Mit Telefonnummer fortfahren
                </Button>
              </form>

              {/* Switch mode */}
              <div className="text-center mt-6">
                <span className="text-muted-foreground">
                  {mode === "login" ? "Noch kein Konto?" : "Du hast bereits ein Konto?"}
                </span>{" "}
                <Button
                  variant="link"
                  className="text-primary p-0 h-auto font-semibold"
                  onClick={() => {
                    setError(null);
                    setInfoMessage(null);
                    setMode(mode === "login" ? "signup" : "login");
                  }}
                >
                  {mode === "login" ? "Konto erstellen" : "Anmelden"}
                </Button>
              </div>
            </motion.div>
          )}

          {mode === "phone" && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex-1 flex flex-col p-6"
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMode("welcome")}
                  className="rounded-full"
                >
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">Telefonnummer</h1>
                  <p className="text-sm text-muted-foreground">
                    Wir senden dir einen Bestätigungscode
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 flex-1">
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="+966 5XX XXX XXXX"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="h-14 pr-12 rounded-2xl bg-muted/50 border-0 text-right"
                    dir="ltr"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 rounded-2xl text-lg font-semibold bg-gradient-to-r from-primary to-[#3155ff] hover:opacity-90"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Code senden"
                  )}
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
