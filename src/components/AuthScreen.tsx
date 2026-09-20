import React, { useState } from 'react';
import { Stethoscope } from 'lucide-react';

interface AuthScreenProps {
  onLogin: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 selection:bg-primary/15 selection:text-primary">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-white mb-4 shadow-xs">
            <Stethoscope className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink mb-1">MediAgent AI</h1>
          <p className="text-muted text-xs">Clinical Decision-Support Triage System</p>
        </div>

        <div className="bg-surface border border-muted/20 rounded-2xl p-7 shadow-xs">
          <h2 className="text-base font-semibold text-ink mb-5">
            {isSignUp ? 'Create your clinician access account' : 'Sign in to access clinical workspace'}
          </h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onLogin();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5" htmlFor="email">
                Institutional Email
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="clinician@hospital.org"
                className="w-full px-3 py-2 text-sm bg-surface border border-muted/20 rounded-lg text-ink placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5" htmlFor="password">
                Access Password
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••••••"
                className="w-full px-3 py-2 text-sm bg-surface border border-muted/20 rounded-lg text-ink placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-primary hover:bg-[#09472C] text-white text-sm font-semibold rounded-lg transition-colors mt-2 shadow-xs cursor-pointer"
            >
              {isSignUp ? 'Register & Continue' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 text-center text-xs">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-muted hover:text-primary font-medium transition-colors cursor-pointer"
            >
              {isSignUp ? 'Already registered? Sign in' : "Need credentials? Register access"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
