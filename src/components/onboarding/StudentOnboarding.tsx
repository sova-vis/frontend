"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, Calendar } from "lucide-react";

const levels = ["O Level"];
const subjectsList = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "Economics",
  "Business Studies",
  "Accounting",
  "English Language",
];

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 50 : -50,
    opacity: 0,
  }),
};

export default function StudentOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);

  const [formData, setFormData] = useState({
    name: "",
    level: "",
    subjects: [] as string[],
    examSession: "",
  });

  const nextStep = () => {
    if (step < 3) {
      setDirection(1);
      setStep(step + 1);
    } else {
      // Submit logic here
      console.log("Submitting:", formData);
      // Save name to localStorage for personalization in this prototype
      if (typeof window !== "undefined") {
        localStorage.setItem("studentName", formData.name);
      }
      router.push("/student/dashboard");
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const updateFormData = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSubject = (subject: string) => {
    setFormData((prev) => {
      const current = prev.subjects;
      if (current.includes(subject)) {
        return { ...prev, subjects: current.filter((s) => s !== subject) };
      } else {
        return { ...prev, subjects: [...current, subject] };
      }
    });
  };

  const isStepValid = () => {
    switch (step) {
      case 0:
        return formData.name.trim().length > 0;
      case 1:
        return formData.level.length > 0;
      case 2:
        return formData.subjects.length > 0;
      case 3:
        return true; // Optional
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden p-8 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: `${((step + 1) / 4) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="mb-8 mt-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-2 font-display">
            {step === 0 && "Welcome!"}
            {step === 1 && "Choose your level"}
            {step === 2 && "Pick your subjects"}
            {step === 3 && "Exam preparation"}
          </h2>
          <p className="text-gray-500">
            {step === 0 && "Let's get to know you. What's your name?"}
            {step === 1 && "Confirm you are studying for O Levels."}
            {step === 2 && "Select the subjects you are currently studying."}
            {step === 3 &&
              "When is your next big exam session? (Optional)"}
          </p>
        </div>

        <div className="relative min-h-[300px]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute w-full"
              >
                <input
                  type="text"
                  placeholder="Your Name"
                  value={formData.name}
                  onChange={(e) => updateFormData("name", e.target.value)}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
                  autoFocus
                />
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute w-full space-y-3"
              >
                {levels.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => updateFormData("level", lvl)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${formData.level === lvl
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-100 hover:border-gray-200 text-gray-700"
                      }`}
                  >
                    <span className="font-semibold text-lg">{lvl}</span>
                  </button>
                ))}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute w-full"
              >
                <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {subjectsList.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => toggleSubject(sub)}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all text-left ${formData.subjects.includes(sub)
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute w-full"
              >
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">Exam Session</label>
                  <div className="relative">
                    <input
                      type="month"
                      value={formData.examSession}
                      onChange={(e) => updateFormData("examSession", e.target.value)}
                      className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <Calendar className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex justify-between mt-8 pt-4 border-t border-gray-50">
          <button
            onClick={prevStep}
            disabled={step === 0}
            className={`flex items-center text-gray-500 hover:text-gray-900 transition-colors ${step === 0 ? "opacity-0 cursor-default" : ""
              }`}
          >
            <ChevronLeft size={20} className="mr-1" />
            Back
          </button>
          <button
            onClick={nextStep}
            disabled={!isStepValid()}
            className={`flex items-center px-6 py-3 rounded-full font-semibold transition-all ${isStepValid()
                ? "bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
          >
            {step === 3 ? "Get Started" : "Continue"}
            <ArrowRight size={20} className="ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}
