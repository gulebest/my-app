import { AuthPage } from '../components/auth/AuthPage';

interface SignInPageProps {
   onSubmit: (payload: {
      email: string;
      password: string;
   }) => Promise<void> | void;
   onSwitchToSignUp: () => void;
}

export function SignInPage({ onSubmit, onSwitchToSignUp }: SignInPageProps) {
   return (
      <AuthPage
         mode="signin"
         onSubmit={onSubmit}
         onSwitchMode={onSwitchToSignUp}
      />
   );
}
