import { useState, useRef, useEffect } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

type Step = 'phone' | 'otp' | 'name';

const COUNTRY_CODES = [
  { code: '+1', label: '+1 US/CA' },
  { code: '+44', label: '+44 UK' },
  { code: '+61', label: '+61 AU' },
  { code: '+49', label: '+49 DE' },
  { code: '+33', label: '+33 FR' },
];

export function Login() {
  const { user, dbUser, loading, refreshDbUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('phone');
  const [countryCode, setCountryCode] = useState('+1');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user && dbUser?.display_name) {
      navigate('/', { replace: true });
    } else if (user && dbUser && !dbUser.display_name) {
      setStep('name');
    }
  }, [loading, user, dbUser, navigate]);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
    };
  }, []);

  const getOrCreateRecaptcha = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
    return recaptchaRef.current;
  };

  const handleSendCode = async () => {
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) {
      setError('Please enter a valid phone number.');
      return;
    }
    setSubmitting(true);
    try {
      const verifier = getOrCreateRecaptcha();
      const result = await signInWithPhoneNumber(auth, `${countryCode}${digits}`, verifier);
      setConfirmation(result);
      setStep('otp');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else if (code === 'auth/invalid-phone-number') {
        setError('Invalid phone number. Please check and try again.');
      } else {
        setError('Failed to send code. Please try again.');
      }
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!confirmation) return;
    setError('');
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }
    setSubmitting(true);
    try {
      await confirmation.confirm(otp);
      // onAuthStateChanged in AuthContext takes it from here
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/invalid-verification-code') {
        setError('Incorrect code. Please try again.');
      } else if (code === 'auth/code-expired') {
        setError('Code expired. Please request a new one.');
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetName = async () => {
    if (!displayName.trim()) {
      setError('Please enter your name.');
      return;
    }
    setSubmitting(true);
    try {
      await refreshDbUser(displayName.trim());
      navigate('/', { replace: true });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetToPhone = () => {
    setStep('phone');
    setOtp('');
    setError('');
    setConfirmation(null);
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div id="recaptcha-container" />

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 mb-4">
            <span className="text-white text-2xl font-bold">T</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Troupes</h1>
          <p className="mt-2 text-gray-500 text-sm">Coordinate your performing arts group</p>
        </div>

        {step === 'phone' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone number
              </label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleSendCode}
              disabled={submitting}
              className="w-full bg-violet-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Sending…' : 'Send code'}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              We sent a 6-digit code to{' '}
              <span className="font-medium">
                {countryCode} {phone}
              </span>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-center tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleVerifyOtp}
              disabled={submitting}
              className="w-full bg-violet-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Verifying…' : 'Verify'}
            </button>

            <button
              onClick={resetToPhone}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Use a different number
            </button>
          </div>
        )}

        {step === 'name' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">Welcome! What should we call you?</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Smith"
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleSetName}
              disabled={submitting}
              className="w-full bg-violet-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving…' : "Let's go"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
