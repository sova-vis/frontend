import { SignIn } from "@clerk/nextjs";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Propel",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <SignIn 
          routing="hash"
          appearance={{
            elements: {
              formButtonPrimary:
                "bg-brand-burgundy hover:bg-brand-burgundy/90 text-white font-bold py-2 px-4 rounded-none shadow-lg transition-all",
              card: "shadow-lg border border-slate-200 rounded-2xl",
              headerTitle: "text-2xl font-bold text-brand-burgundy",
              socialButtons: "flex gap-3 mb-6",
              socialButtonsBlockButton: "flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800",
              dividerLine: "bg-slate-200",
              dividerText: "text-slate-500",
              footerAction: "text-center mt-4",
              footerActionLink: "text-brand-burgundy hover:text-brand-burgundy/90 font-semibold",
            },
          }}
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  );
}
