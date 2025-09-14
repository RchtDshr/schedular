export default function EmailConfirmationPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                ></path>
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Check Your Email
            </h2>
            
            <div className="text-sm text-gray-600 space-y-3">
              <p>
                We've sent a confirmation link to your email address.
              </p>
              <p>
                <strong>Click the link in your email</strong> to verify your account and you'll be automatically signed in.
              </p>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-md">
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">What's next?</p>
                <ol className="list-decimal list-inside space-y-1 text-left">
                  <li>Check your email inbox (and spam folder)</li>
                  <li>Click the confirmation link</li>
                  <li>You'll be automatically redirected to your dashboard</li>
                </ol>
              </div>
            </div>

            <div className="mt-6 text-xs text-gray-500">
              <p>
                Didn't receive the email? Check your spam folder or try signing up again.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}