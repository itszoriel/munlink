type Props = {
  steps: string[]
  current: number
}

export default function Stepper({ steps, current }: Props) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between relative px-4">
        {/* Background connecting line */}
        <div className="absolute top-5 left-1/4 right-1/4 h-0.5 bg-gray-200" />
        
        {/* Progress line (filled portion) */}
        {current > 1 && (
          <div
            className="absolute top-5 left-1/4 h-0.5 bg-ocean-500 transition-all duration-500"
            style={{ width: `${((current - 1) / (steps.length - 1)) * 50}%` }}
          />
        )}
        
        {/* Steps */}
        {steps.map((label, idx) => {
          const stepNumber = idx + 1
          const isCompleted = current > stepNumber
          const isCurrent = current === stepNumber
          
          return (
            <div key={label} className="flex flex-col items-center relative z-10 flex-1">
              {/* Step circle */}
              <div className="relative">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-110'
                      : isCurrent
                      ? 'bg-ocean-gradient text-white shadow-lg shadow-ocean-500/30 scale-110 ring-4 ring-ocean-500/20'
                      : 'bg-white border-2 border-gray-300 text-gray-500'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>
                {/* Pulse animation for current step */}
                {isCurrent && (
                  <div className="absolute inset-0 rounded-full bg-ocean-500 animate-ping opacity-20" />
                )}
              </div>
              
              {/* Step label */}
              <div className="mt-3 text-center w-full px-2">
                <div
                  className={`text-sm font-semibold transition-colors ${
                    isCompleted
                      ? 'text-emerald-700'
                      : isCurrent
                      ? 'text-ocean-700'
                      : 'text-gray-500'
                  }`}
                >
                  {label}
                </div>
                {isCurrent && (
                  <div className="mt-1 text-xs text-ocean-600 font-medium">Current</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


