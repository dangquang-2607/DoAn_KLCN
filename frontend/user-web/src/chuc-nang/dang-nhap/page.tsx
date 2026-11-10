﻿"use client";

/** Điều phối đăng nhập, đăng ký, khôi phục và đổi mật khẩu lần đầu. */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import api, { clearSession, saveSession } from "@/dung-chung/connect-api/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  newPasswordError,
  passwordCharacterCount,
} from "@/dung-chung/xac-thuc/passwordPolicy";
import {
  Activity,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
  X,
  RotateCw,
  UserPlus,
  LogIn,
} from "lucide-react";
import ForgotPasswordModal from "./thanh-phan/ForgotPasswordModal";
import FirstTimePasswordModal from "./thanh-phan/FirstTimePasswordModal";
import styles from "./CSS/login.module.css";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

type ApiFailure = {
  response?: { status?: number; data?: { detail?: unknown } };
};

function apiFailure(error: unknown): ApiFailure {
  return typeof error === "object" && error !== null
    ? (error as ApiFailure)
    : {};
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidRegistrationEmail(email: string) {
  return /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@gmail\.com$/i.test(
    email,
  );
}

// ─── Thành phần hỗ trợ hiển thị lỗi trường nhập liệu ──────────────────────────
function FieldError({ id, msg }: { id?: string; msg?: string }) {
  if (!msg) return null;
  return (
    <motion.p
      id={id}
      role="alert"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold leading-4 text-rose-700"
    >
      <AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{msg}</span>
    </motion.p>
  );
}

function FormAlert({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-start gap-2 rounded-[6px] border border-rose-200 bg-rose-50 py-2 pl-3 pr-2 text-sm text-rose-700"
    >
      <div
        role="alert"
        className="flex min-w-0 flex-1 items-start gap-2 py-1.5 leading-5"
      >
        <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 break-words">{message}</span>
      </div>
      <button
        type="button"
        aria-label="Đóng thông báo lỗi"
        onClick={onDismiss}
        className="grid size-8 shrink-0 place-items-center rounded-[6px] hover:bg-rose-100"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </motion.div>
  );
}

// ─── Hiệu ứng chuyển cảnh đồng bộ theo chuyển động trượt 1:1 siêu mượt ─────────
const formFadeVariants: Variants = {
  hidden: {
    opacity: 0,
    pointerEvents: "none",
    transition: {
      duration: 0.24,
      ease: [0.65, 0, 0.35, 1],
    },
  },
  visible: {
    opacity: 1,
    pointerEvents: "auto",
    transition: {
      duration: 0.38,
      delay: 0.18,
      ease: [0.65, 0, 0.35, 1],
    },
  },
  exit: {
    opacity: 0,
    pointerEvents: "none",
    transition: {
      duration: 0.24,
      ease: [0.65, 0, 0.35, 1],
    },
  },
};

const formItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.32,
      ease: [0.65, 0, 0.35, 1],
    },
  },
};

export default function LoginPage() {
  const router = useRouter();
  const cache = useQueryClient();

  // ── Trạng thái tab: true là đăng nhập, false là đăng ký.
  const [isLogin, setIsLogin] = useState(true);

  // ── Dữ liệu biểu mẫu đăng nhập.
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginEmailError, setLoginEmailError] = useState("");
  const [loginPassError, setLoginPassError] = useState("");
  const [loginRemember, setLoginRemember] = useState(true);

  // ── Dữ liệu biểu mẫu đăng ký.
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirm, setRegisterConfirm] = useState("");
  const [showRegisterPass, setShowRegisterPass] = useState(false);
  const [showRegisterConfirm, setShowRegisterConfirm] = useState(false);
  const [regNameError, setRegNameError] = useState("");
  const [regEmailError, setRegEmailError] = useState("");
  const [regPassError, setRegPassError] = useState("");
  const [regConfirmError, setRegConfirmError] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(true);

  // ── Trạng thái thông báo dùng chung của màn hình.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isShake, setIsShake] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  // ── Trạng thái modal quên mật khẩu.
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotResendCountdown, setForgotResendCountdown] = useState(0);

  // ── Trạng thái modal đổi mật khẩu lần đầu.
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  const [firstTimePass, setFirstTimePass] = useState("");
  const [firstTimeConfirmPass, setFirstTimeConfirmPass] = useState("");
  const [firstTimeError, setFirstTimeError] = useState("");
  const [firstTimeLoading, setFirstTimeLoading] = useState(false);
  const [firstTimeSuccess, setFirstTimeSuccess] = useState(false);

  // ── Giới hạn thử sai liên tiếp ở phía trình duyệt.
  const [failCount, setFailCount] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [remainingLockSec, setRemainingLockSec] = useState(0);

  useEffect(() => {
    const savedFailCount = parseInt(
      sessionStorage.getItem("user_fail_count") || "0",
      10,
    );
    const savedLockUntil = parseInt(
      sessionStorage.getItem("user_lock_until") || "0",
      10,
    );
    queueMicrotask(() => {
      if (
        new URLSearchParams(window.location.search).get("reason") ===
        "invalid-session"
      ) {
        setError(
          "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại để tiếp tục.",
        );
      }
      setFailCount(Number.isFinite(savedFailCount) ? savedFailCount : 0);
      setLockUntil(Number.isFinite(savedLockUntil) ? savedLockUntil : 0);
    });
  }, []);

  const triggerShake = () => {
    setIsShake(true);
    setTimeout(() => setIsShake(false), 600);
  };

  const clearErrors = () => {
    setError("");
    setLoginEmailError("");
    setLoginPassError("");
    setRegNameError("");
    setRegEmailError("");
    setRegPassError("");
    setRegConfirmError("");
  };

  // Chuyển chế độ đăng nhập/đăng ký và xóa lỗi cũ để không rò trạng thái giữa hai form.
  const switchTab = (toLogin: boolean) => {
    if (toLogin === isLogin) return;
    clearErrors();
    setIsLogin(toLogin);
  };

  // ── Bộ đếm thời gian còn lại của khóa tạm thời.
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      if (lockUntil > now) {
        setRemainingLockSec(Math.ceil((lockUntil - now) / 1000));
      } else {
        setRemainingLockSec(0);
        if (lockUntil > 0) {
          setLockUntil(0);
          setFailCount(0);
          sessionStorage.removeItem("user_fail_count");
          sessionStorage.removeItem("user_lock_until");
        }
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  // ── Bộ đếm chờ trước khi được gửi lại OTP.
  useEffect(() => {
    if (forgotResendCountdown <= 0) return;
    const timer = setInterval(() => {
      setForgotResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [forgotResendCountdown]);

  // ── Tính độ mạnh mật khẩu để phản hồi trước khi gửi.
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (passwordCharacterCount(pass) >= 6) score++;
    if (passwordCharacterCount(pass) >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const regPassStrength = getPasswordStrength(registerPassword);
  const getStrengthLabel = (score: number) => {
    if (score <= 1)
      return {
        text: "Rất yếu",
        color: "bg-rose-500",
        textColor: "text-rose-600",
      };
    if (score === 2)
      return {
        text: "Yếu",
        color: "bg-amber-500",
        textColor: "text-amber-600",
      };
    if (score === 3)
      return {
        text: "Trung bình",
        color: "bg-blue-500",
        textColor: "text-blue-600",
      };
    if (score === 4)
      return {
        text: "Mạnh",
        color: "bg-emerald-500",
        textColor: "text-emerald-600",
      };
    return {
      text: "Rất an toàn",
      color: "bg-emerald-600",
      textColor: "text-emerald-600",
    };
  };

  // ── Xử lý đăng nhập và khởi tạo phiên người dùng.
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || remainingLockSec > 0) return;

    let hasErr = false;
    setLoginEmailError("");
    setLoginPassError("");
    setError("");

    if (!loginEmail.trim()) {
      setLoginEmailError("Vui lòng nhập email");
      hasErr = true;
    } else if (!isValidEmail(loginEmail.trim())) {
      setLoginEmailError("Vui lòng nhập địa chỉ email hợp lệ");
      hasErr = true;
    }
    if (!loginPassword) {
      setLoginPassError("Vui lòng nhập mật khẩu");
      hasErr = true;
    }

    if (hasErr) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", {
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });

      const { access_token, refresh_token, must_change_password } = res.data;

      // Lưu token theo lựa chọn duy trì đăng nhập của người dùng.
      saveSession(access_token, refresh_token, loginRemember);
      await cache.cancelQueries();
      cache.clear();

      // Tải hồ sơ từ /auth/me để xác định trạng thái thiết lập tài khoản.
      try {
        const meRes = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        sessionStorage.setItem("user", JSON.stringify(meRes.data));
        if (loginRemember)
          localStorage.setItem("user", JSON.stringify(meRes.data));
      } catch {}

      // Xóa bộ đếm thử sai sau khi đăng nhập thành công.
      setFailCount(0);
      setLockUntil(0);
      sessionStorage.removeItem("user_fail_count");
      sessionStorage.removeItem("user_lock_until");

      // Kiểm tra yêu cầu đổi mật khẩu trong lần đăng nhập đầu tiên.
      if (must_change_password) {
        setShowFirstTimeModal(true);
        setLoading(false);
        return;
      }

      setSuccessToast("Đăng nhập thành công!");
      setTimeout(() => {
        router.push("/");
      }, 700);
    } catch (err: unknown) {
      triggerShake();
      const failure = apiFailure(err);
      const status = failure.response?.status;
      const detail = failure.response?.data?.detail;

      if (status === 400 || status === 401) {
        const nextFail = failCount + 1;
        setFailCount(nextFail);
        sessionStorage.setItem("user_fail_count", String(nextFail));

        if (nextFail >= MAX_ATTEMPTS) {
          const lockedTime = Date.now() + LOCKOUT_SECONDS * 1000;
          setLockUntil(lockedTime);
          sessionStorage.setItem("user_lock_until", String(lockedTime));
          setError(
            `Bạn đã nhập sai ${MAX_ATTEMPTS} lần liên tiếp. Tài khoản bị tạm khóa 30 giây để bảo vệ an toàn.`,
          );
        } else {
          setError(
            typeof detail === "string"
              ? detail
              : `Email hoặc mật khẩu không chính xác! (Còn ${MAX_ATTEMPTS - nextFail} lần thử)`,
          );
        }
      } else if (status === 403) {
        setError(
          typeof detail === "string"
            ? detail
            : "Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.",
        );
      } else {
        setError(
          typeof detail === "string"
            ? detail
            : "Không thể kết nối tới máy chủ. Vui lòng thử lại sau.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Xử lý đăng ký tài khoản mới.
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    let hasErr = false;
    setRegNameError("");
    setRegEmailError("");
    setRegPassError("");
    setRegConfirmError("");
    setError("");

    if (!registerName.trim()) {
      setRegNameError("Vui lòng nhập họ và tên của bạn");
      hasErr = true;
    } else if (registerName.normalize("NFC").trim().length > 150) {
      setRegNameError("Họ và tên vượt quá giới hạn 150 ký tự.");
      hasErr = true;
    }
    const email = registerEmail.trim().toLowerCase();
    if (!email) {
      setRegEmailError("Vui lòng nhập địa chỉ email");
      hasErr = true;
    } else if (!isValidRegistrationEmail(email)) {
      setRegEmailError("Nhập email hợp lệ có đuôi @gmail.com.");
      hasErr = true;
    }
    if (!registerPassword) {
      setRegPassError("Vui lòng tạo mật khẩu");
      hasErr = true;
    } else if (newPasswordError(registerPassword)) {
      setRegPassError(newPasswordError(registerPassword));
      hasErr = true;
    }
    if (registerPassword !== registerConfirm) {
      setRegConfirmError("Mật khẩu xác nhận không khớp");
      hasErr = true;
    }
    if (!agreeTerms) {
      setError("Vui lòng đồng ý với Điều khoản & Chính sách bảo mật");
      hasErr = true;
    }

    if (hasErr) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/register", {
        full_name: registerName.trim(),
        email,
        password: registerPassword,
      });

      setSuccessToast(
        "Tạo tài khoản thành công! Đang chuyển sang màn hình đăng nhập...",
      );
      setTimeout(() => {
        setLoginEmail(email);
        setLoginPassword(registerPassword);
        switchTab(true);
        setSuccessToast("");
      }, 1200);
    } catch (err: unknown) {
      triggerShake();
      const detail = apiFailure(err).response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Gửi OTP cho luồng khôi phục mật khẩu.
  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotLoading) return;
    if (!forgotEmail.trim() || !isValidEmail(forgotEmail.trim())) {
      setForgotError("Vui lòng nhập địa chỉ email hợp lệ");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    try {
      await api.post("/auth/forgot-password", {
        email: forgotEmail.trim().toLowerCase(),
      });
      setForgotStep(2);
      setForgotResendCountdown(60);
    } catch (err: unknown) {
      const detail = apiFailure(err).response?.data?.detail;
      setForgotError(
        typeof detail === "string"
          ? detail
          : "Không tìm thấy tài khoản với email này.",
      );
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Xác minh OTP và đặt mật khẩu mới.
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotLoading) return;
    if (!/^\d{6}$/.test(forgotOtp.trim())) {
      setForgotError("Vui lòng nhập mã OTP 6 số");
      return;
    }
    if (newPasswordError(forgotNewPassword)) {
      setForgotError(newPasswordError(forgotNewPassword));
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Xác nhận mật khẩu mới không khớp");
      return;
    }

    setForgotLoading(true);
    setForgotError("");
    try {
      await api.post("/auth/reset-password", {
        email: forgotEmail.trim().toLowerCase(),
        otp_code: forgotOtp.trim(),
        new_password: forgotNewPassword,
      });
      setForgotStep(3);
    } catch (err: unknown) {
      const detail = apiFailure(err).response?.data?.detail;
      setForgotError(
        typeof detail === "string"
          ? detail
          : "Mã OTP không chính xác hoặc đã hết hạn.",
      );
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Xử lý thiết lập mật khẩu riêng trong lần đăng nhập đầu.
  const handleFirstTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (firstTimeLoading) return;
    if (newPasswordError(firstTimePass)) {
      setFirstTimeError(newPasswordError(firstTimePass));
      return;
    }
    if (firstTimePass !== firstTimeConfirmPass) {
      setFirstTimeError("Xác nhận mật khẩu không khớp");
      return;
    }

    setFirstTimeLoading(true);
    setFirstTimeError("");
    try {
      await api.post("/auth/first-time-password", {
        new_password: firstTimePass,
      });
      clearSession(true, true);
      await cache.cancelQueries();
      cache.clear();
      setFirstTimeSuccess(true);
      setTimeout(() => {
        setShowFirstTimeModal(false);
        setFirstTimePass("");
        setFirstTimeConfirmPass("");
        setFirstTimeSuccess(false);
        setLoginPassword("");
        setSuccessToast(
          "Đã thiết lập mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.",
        );
      }, 1000);
    } catch (err: unknown) {
      const detail = apiFailure(err).response?.data?.detail;
      setFirstTimeError(
        typeof detail === "string"
          ? detail
          : "Đổi mật khẩu thất bại. Vui lòng thử lại.",
      );
    } finally {
      setFirstTimeLoading(false);
    }
  };

  return (
    <div
      className={`${styles.page} bg-[#F8FAFC] text-slate-800 flex items-center justify-center p-4 sm:p-6 lg:px-10 relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white`}
    >
      {/* ── Nền chuyển sắc động theo phong cách Cobalt sáng. ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[25%] -left-[15%] w-[650px] h-[650px] rounded-full bg-blue-100/60 blur-[130px]" />
        <div className="absolute -bottom-[25%] -right-[15%] w-[700px] h-[700px] rounded-full bg-slate-200/50 blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-sky-50/50 blur-[100px]" />
        {/* Họa tiết lưới nền nhẹ. */}
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `radial-gradient(rgba(148, 163, 184, 0.4) 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* ── Thông báo thao tác thành công. ── */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-[6px] shadow-xl shadow-emerald-500/20 flex items-center gap-3 border border-emerald-400/30 text-sm font-semibold"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-100" />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Khung cố định chuẩn Swiss 6px, chỉ hai cột bên trong trượt ngang. ── */}
      <motion.div
        className={`${styles.card} ${isLogin ? "" : styles.register} w-full max-w-[880px] bg-white border border-slate-200/90 rounded-[6px] shadow-[0_24px_60px_-15px_rgba(15,35,70,0.12),0_10px_30px_-10px_rgba(0,0,0,0.04)] overflow-hidden relative z-10 transition-shadow duration-500 ${
          isShake ? "animate-shake" : ""
        }`}
      >
        <div className="flex flex-col lg:flex-row relative lg:min-h-[540px]">
          {/* ══════════════════════════════════════════════════════════════════════
              KHỐI 1: Giới thiệu sản phẩm (trượt trái/phải từ 0% đến 140%)
              ══════════════════════════════════════════════════════════════════════ */}
          <div
            className={`${styles.showcase} hidden lg:flex lg:w-5/12 bg-gradient-to-br from-[#0f2347] via-[#16335f] to-[#0a1832] p-7 flex-col justify-center relative overflow-hidden text-center text-white z-20 shadow-2xl`}
          >
            {/* Quầng sáng nền dịu mắt, hòa sắc tự nhiên không gắt chói */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-sky-400/[0.08] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/[0.08] rounded-full blur-2xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

            {/* Đầu trang và nhận diện thương hiệu. */}
            <div className="relative z-10">
              <div className="mb-7 flex items-center justify-center gap-3 text-left">
                <div className="w-10 h-10 shrink-0 rounded-[6px] bg-white/[0.08] border border-white/15 flex items-center justify-center shadow-sm">
                  <Activity className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <span className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5">
                    CapitalFlow
                  </span>
                  <p className="text-[11px] leading-[18px] text-slate-300 font-medium">
                    Hệ sinh thái quản trị tài chính đa kênh
                  </p>
                </div>
              </div>

              {/* Chuyển đổi nội dung động bằng AnimatePresence mượt mà. */}
              <div className="grid">
                <AnimatePresence initial={false}>
                  {isLogin ? (
                    <motion.div
                      key="showcase-login"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: 0.18,
                        ease: [0.65, 0, 0.35, 1],
                      }}
                      className="space-y-3 [grid-area:1/1]"
                    >
                      <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
                        Nắm bắt dòng tiền, <br />
                        <span className="text-sky-300">
                          Kiến tạo tương lai.
                        </span>
                      </h2>
                      <p className="mx-auto max-w-[34ch] text-pretty text-sm text-slate-300/90 leading-relaxed">
                        Theo dõi chi tiêu thời gian thực, quét hóa đơn bằng AI
                        OCR và nhận báo cáo ngân sách tự động chỉ với 1 cú
                        click.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="showcase-register"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: 0.18,
                        ease: [0.65, 0, 0.35, 1],
                      }}
                      className="space-y-3 [grid-area:1/1]"
                    >
                      <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
                        Khởi đầu tự do tài chính, <br />
                        <span className="text-emerald-300">
                          Thông minh & An toàn.
                        </span>
                      </h2>
                      <p className="mx-auto max-w-[34ch] text-pretty text-sm text-slate-300/90 leading-relaxed">
                        Thiết lập tài khoản trong 30 giây để kích hoạt AI phân
                        tích danh mục, quản lý đa ví và bảo mật dữ liệu chuẩn
                        ngân hàng.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════
              KHỐI 2: Biểu mẫu xác thực (trượt phải/trái từ 0% đến -71,428%)
              ══════════════════════════════════════════════════════════════════════ */}
          <div
            className={`${styles.formPanel} w-full lg:w-7/12 flex flex-col justify-center bg-white relative z-10`}
          >
            {/* ── Bộ chuyển tab phân đoạn nổi phía trên. ── */}
            <div className="flex items-center justify-between gap-3 mb-5">
              {/* Điều khiển phân đoạn với nền chỉ báo chuyển động mượt mà 500ms. */}
              <div className="relative p-1 bg-slate-100/90 border border-slate-200/80 rounded-[6px] flex items-center shadow-inner w-full">
                {/* Thanh trượt CSS mượt mà không gây reflow layout */}
                <div
                  className={`absolute left-1 top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-[6px] shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/60 z-0 transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] ${
                    isLogin ? "translate-x-0" : "translate-x-full"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => switchTab(true)}
                  className={`relative flex-1 py-2.5 rounded-[6px] text-sm font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 z-10 ${
                    isLogin
                      ? "text-blue-700"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng Nhập</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchTab(false)}
                  className={`relative flex-1 py-2.5 rounded-[6px] text-sm font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 z-10 ${
                    !isLogin
                      ? "text-blue-700"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Đăng Ký</span>
                </button>
              </div>
            </div>

            {/* Hai form cùng ô lưới để giữ bố cục khi chuyển cảnh. */}
            <div className="relative grid grid-cols-1">
              {/* Hai form luôn giữ chỗ; form ẩn không nhận focus hay thao tác. */}
              <motion.form
                key="form-login-option-a"
                variants={formFadeVariants}
                initial={false}
                animate={isLogin ? "visible" : "hidden"}
                inert={!isLogin}
                aria-hidden={!isLogin}
                onSubmit={handleLogin}
                className="space-y-3.5 [grid-area:1/1] self-start"
              >
                <motion.div variants={formItemVariants}>
                  <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Đăng nhập tài khoản
                  </h1>
                  <p className="text-sm text-slate-500 mt-1.5 leading-5">
                    Nhập thông tin xác thực để truy cập hệ sinh thái tài chính
                    của bạn
                  </p>
                </motion.div>

                {isLogin && (
                  <FormAlert message={error} onDismiss={() => setError("")} />
                )}

                {/* Đăng nhập bằng email. */}
                <motion.div variants={formItemVariants} className="space-y-1.5">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                      <Mail className="w-4 h-4" />
                    </div>
                    {/* Chrome iOS adds autofill attributes such as __gcruniqueid before hydration. */}
                    <input
                      suppressHydrationWarning
                      type="email"
                      aria-label="Email"
                      autoComplete="username"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        if (loginEmailError) setLoginEmailError("");
                      }}
                      placeholder="Nhập email của bạn..."
                      disabled={loading || remainingLockSec > 0}
                      className={`w-full pl-10 pr-4 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-[6px] border transition-all duration-200 outline-none shadow-sm ${
                        loginEmailError
                          ? "border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                          : "border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                      } disabled:opacity-50 disabled:bg-slate-100`}
                    />
                  </div>
                  <FieldError msg={loginEmailError} />
                </motion.div>

                {/* Trường mật khẩu đăng nhập. */}
                <motion.div variants={formItemVariants} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                      Mật khẩu
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotModal(true);
                        setForgotStep(1);
                        setForgotError("");
                        if (isValidEmail(loginEmail.trim()))
                          setForgotEmail(loginEmail.trim());
                      }}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-all"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      suppressHydrationWarning
                      type={showLoginPass ? "text" : "password"}
                      aria-label="Mật khẩu đăng nhập"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (loginPassError) setLoginPassError("");
                      }}
                      placeholder="••••••••"
                      disabled={loading || remainingLockSec > 0}
                      className={`w-full pl-10 pr-11 py-3 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-[6px] border transition-all duration-200 outline-none shadow-sm ${
                        loginPassError
                          ? "border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                          : "border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                      } disabled:opacity-50 disabled:bg-slate-100`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPass(!showLoginPass)}
                      aria-label={
                        showLoginPass
                          ? "Ẩn mật khẩu đăng nhập"
                          : "Hiện mật khẩu đăng nhập"
                      }
                      aria-pressed={showLoginPass}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showLoginPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <FieldError msg={loginPassError} />
                </motion.div>

                {/* Tùy chọn ghi nhớ và tự động duy trì phiên. */}
                <motion.div
                  variants={formItemVariants}
                  className="flex items-center justify-between pt-1"
                >
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      suppressHydrationWarning
                      type="checkbox"
                      checked={loginRemember}
                      onChange={(e) => setLoginRemember(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 transition-all cursor-pointer"
                    />
                    <span className="text-sm font-medium text-slate-600">
                      Ghi nhớ đăng nhập
                    </span>
                  </label>
                </motion.div>

                {/* Nút gửi yêu cầu đăng nhập. */}
                <motion.div variants={formItemVariants} className="pt-2">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading || remainingLockSec > 0}
                    className="w-full py-3.5 px-6 rounded-[6px] bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {loading ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin text-white" />
                        <span>Đang xác thực thông tin...</span>
                      </>
                    ) : remainingLockSec > 0 ? (
                      <>
                        <Lock className="w-4 h-4 text-amber-300" />
                        <span>Tạm khóa (Thử lại sau {remainingLockSec}s)</span>
                      </>
                    ) : (
                      <>
                        <span>Đăng nhập</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </motion.button>
                </motion.div>

                {/* Lối chuyển sang biểu mẫu đăng ký. */}
                <motion.div
                  variants={formItemVariants}
                  className="pt-4 text-center border-t border-slate-100"
                >
                  <p className="text-sm text-slate-500">
                    Chưa có tài khoản?{" "}
                    <button
                      type="button"
                      onClick={() => switchTab(false)}
                      className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                    >
                      Đăng ký ngay
                    </button>
                  </p>
                  <Link
                    href="/account-support"
                    className="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline"
                  >
                    Liên hệ hỗ trợ
                  </Link>
                </motion.div>
              </motion.form>
              {/* BIỂU MẪU ĐĂNG KÝ */}
              <motion.form
                key="form-register-option-a"
                variants={formFadeVariants}
                initial={false}
                animate={isLogin ? "hidden" : "visible"}
                inert={isLogin}
                aria-hidden={isLogin}
                noValidate
                onSubmit={handleRegister}
                className="space-y-3.5 [grid-area:1/1] self-start"
              >
                <motion.div variants={formItemVariants}>
                  <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Tạo tài khoản mới
                  </h1>
                  <p className="text-sm text-slate-500 mt-1.5 leading-5">
                    Trải nghiệm quản trị tài chính cá nhân thế hệ mới theo cách
                    riêng của bạn
                  </p>
                </motion.div>

                {!isLogin && (
                  <FormAlert message={error} onDismiss={() => setError("")} />
                )}

                {/* Trường họ và tên. */}
                <motion.div variants={formItemVariants} className="space-y-1.5">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Họ và tên
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      suppressHydrationWarning
                      type="text"
                      value={registerName}
                      onChange={(e) => {
                        setRegisterName(e.target.value);
                        if (regNameError) setRegNameError("");
                      }}
                      placeholder="Nhập họ và tên"
                      disabled={loading}
                      className={`w-full pl-10 pr-4 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-[6px] border transition-all duration-200 outline-none shadow-sm ${
                        regNameError
                          ? "border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                          : "border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                      }`}
                    />
                  </div>
                  <FieldError msg={regNameError} />
                </motion.div>

                {/* Trường email đăng ký. */}
                <motion.div variants={formItemVariants} className="space-y-1.5">
                  <label
                    htmlFor="registration-email"
                    className="block text-sm font-bold text-slate-700 uppercase tracking-wider"
                  >
                    Email đăng ký
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      suppressHydrationWarning
                      type="email"
                      id="registration-email"
                      autoComplete="email"
                      aria-invalid={Boolean(regEmailError)}
                      aria-describedby={
                        regEmailError ? "registration-email-error" : undefined
                      }
                      value={registerEmail}
                      onChange={(e) => {
                        setRegisterEmail(e.target.value);
                        if (regEmailError) setRegEmailError("");
                      }}
                      placeholder="tenban@gmail.com"
                      disabled={loading}
                      className={`w-full pl-10 pr-4 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-[6px] border transition-all duration-200 outline-none shadow-sm ${
                        regEmailError
                          ? "border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                          : "border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                      }`}
                    />
                  </div>
                  <FieldError
                    id="registration-email-error"
                    msg={regEmailError}
                  />
                </motion.div>

                {/* Lưới nhập mật khẩu và xác nhận mật khẩu. */}
                <motion.div
                  variants={formItemVariants}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {/* Trường mật khẩu mới. */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                      Mật khẩu
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        suppressHydrationWarning
                        type={showRegisterPass ? "text" : "password"}
                        aria-label="Mật khẩu đăng ký"
                        value={registerPassword}
                        onChange={(e) => {
                          setRegisterPassword(e.target.value);
                          if (regPassError) setRegPassError("");
                        }}
                        placeholder="Nhập mật khẩu"
                        disabled={loading}
                        className={`w-full pl-10 pr-10 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-[6px] border transition-all duration-200 outline-none shadow-sm ${
                          regPassError
                            ? "border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                            : "border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPass(!showRegisterPass)}
                        aria-label={
                          showRegisterPass
                            ? "Ẩn mật khẩu đăng ký"
                            : "Hiện mật khẩu đăng ký"
                        }
                        aria-pressed={showRegisterPass}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showRegisterPass ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <FieldError msg={regPassError} />
                  </div>

                  {/* Trường xác nhận mật khẩu mới. */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                      Xác nhận
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        suppressHydrationWarning
                        type={showRegisterConfirm ? "text" : "password"}
                        aria-label="Xác nhận mật khẩu đăng ký"
                        value={registerConfirm}
                        onChange={(e) => {
                          setRegisterConfirm(e.target.value);
                          if (regConfirmError) setRegConfirmError("");
                        }}
                        placeholder="Nhập lại mật khẩu"
                        disabled={loading}
                        className={`w-full pl-10 pr-10 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-900 text-sm font-medium rounded-[6px] border transition-all duration-200 outline-none shadow-sm ${
                          regConfirmError
                            ? "border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                            : "border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowRegisterConfirm(!showRegisterConfirm)
                        }
                        aria-label={
                          showRegisterConfirm
                            ? "Ẩn xác nhận mật khẩu"
                            : "Hiện xác nhận mật khẩu"
                        }
                        aria-pressed={showRegisterConfirm}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showRegisterConfirm ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <FieldError msg={regConfirmError} />
                  </div>
                </motion.div>

                {/* Chỉ báo độ mạnh mật khẩu. */}
                {registerPassword && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-1 pt-0.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Độ mạnh mật khẩu:</span>
                      <span
                        className={`font-bold ${getStrengthLabel(regPassStrength).textColor}`}
                      >
                        {getStrengthLabel(regPassStrength).text}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <div
                          key={lvl}
                          className={`h-full rounded-full transition-colors duration-300 ${
                            regPassStrength >= lvl
                              ? getStrengthLabel(regPassStrength).color
                              : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Xác nhận đồng ý điều khoản sử dụng. */}
                <motion.div variants={formItemVariants} className="pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      suppressHydrationWarning
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                    />
                    <span className="text-sm text-slate-600 leading-snug">
                      Tôi đồng ý với{" "}
                      <a
                        href="#"
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        Điều khoản dịch vụ
                      </a>{" "}
                      và{" "}
                      <a
                        href="#"
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        Chính sách quyền riêng tư
                      </a>
                    </span>
                  </label>
                </motion.div>

                {/* Nút gửi yêu cầu đăng ký. */}
                <motion.div variants={formItemVariants} className="pt-2">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-6 rounded-[6px] bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {loading ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin text-white" />
                        <span>Đang khởi tạo tài khoản...</span>
                      </>
                    ) : (
                      <>
                        <span>Tạo tài khoản</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </motion.button>
                </motion.div>

                {/* Lối chuyển về biểu mẫu đăng nhập. */}
                <motion.div
                  variants={formItemVariants}
                  className="pt-4 text-center border-t border-slate-100"
                >
                  <p className="text-sm text-slate-500">
                    Đã có tài khoản?{" "}
                    <button
                      type="button"
                      onClick={() => switchTab(true)}
                      className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                    >
                      Đăng nhập
                    </button>
                  </p>
                </motion.div>
              </motion.form>
            </div>
          </div>
        </div>
      </motion.div>

      <ForgotPasswordModal
        show={showForgotModal}
        step={forgotStep}
        email={forgotEmail}
        otp={forgotOtp}
        newPassword={forgotNewPassword}
        confirmPassword={forgotConfirmPassword}
        loading={forgotLoading}
        error={forgotError}
        resendCountdown={forgotResendCountdown}
        onClose={() => setShowForgotModal(false)}
        onEmailChange={setForgotEmail}
        onOtpChange={setForgotOtp}
        onNewPasswordChange={setForgotNewPassword}
        onConfirmPasswordChange={setForgotConfirmPassword}
        onSendOtp={handleSendForgotOtp}
        onResetPassword={handleResetPassword}
        onResend={() => {
          handleSendForgotOtp({
            preventDefault: () => {},
          } as unknown as React.FormEvent);
        }}
        onGoToLogin={() => {
          setShowForgotModal(false);
          setLoginEmail(forgotEmail);
          setLoginPassword("");
          switchTab(true);
        }}
      />

      <FirstTimePasswordModal
        show={showFirstTimeModal}
        password={firstTimePass}
        confirmPassword={firstTimeConfirmPass}
        loading={firstTimeLoading}
        error={firstTimeError}
        success={firstTimeSuccess}
        onPasswordChange={setFirstTimePass}
        onConfirmChange={setFirstTimeConfirmPass}
        onSubmit={handleFirstTimeSubmit}
      />
    </div>
  );
}
