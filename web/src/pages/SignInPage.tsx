import { SignIn } from "@clerk/clerk-react";

export default function SignInPage() {
    return (
        <div className="min-h-screen flex">
            {/* Left branding panel — hidden on mobile */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e293b 100%)' }}>
                {/* decorative circles */}
                <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }} />
                <div className="absolute bottom-10 right-10 w-64 h-64 rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />

                <div className="relative z-10 text-white px-12 max-w-md">
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                            <span className="text-white font-black text-lg">S</span>
                        </div>
                        <span className="text-2xl font-bold tracking-tight">ShiftSync</span>
                    </div>
                    <h2 className="text-4xl font-extrabold leading-tight mb-4">
                        Smart scheduling<br />for modern teams.
                    </h2>
                    <p className="text-slate-400 text-lg leading-relaxed">
                        Manage shifts, track availability, handle swaps, and stay ahead of overtime — all in one place.
                    </p>
                    <div className="mt-10 flex gap-3">
                        {['Fairness Engine', 'Real-time Updates', 'Swap Requests'].map((tag) => (
                            <span key={tag} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-slate-300 border border-white/10">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right sign-in panel */}
            <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
                <div className="w-full max-w-[400px]">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                            <span className="text-white font-black text-sm">S</span>
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-900">ShiftSync</span>
                    </div>
                    <SignIn
                        appearance={{
                            variables: {
                                fontFamily: "'Inter', system-ui, sans-serif",
                                borderRadius: "0.75rem",
                                colorPrimary: "#2563eb",
                            },
                            elements: {
                                formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-sm normal-case font-semibold shadow-sm",
                                card: "shadow-none border-0 bg-transparent p-0",
                                rootBox: "w-full",
                            },
                        }}
                        routing="path"
                        path="/sign-in"
                        signUpUrl="/sign-up"
                    />
                </div>
            </div>
        </div>
    );
}
