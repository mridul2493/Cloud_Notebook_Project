'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DemoPage() {
  const [activeDemo, setActiveDemo] = useState('features');

  const demoSections = {
    features: {
      title: '🚀 Platform Features Demo',
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-3 text-blue-600">Real-time Collaboration</h3>
              <p className="text-gray-600 mb-4">Multiple users can edit notebooks simultaneously with live cursors and conflict resolution.</p>
              <div className="bg-gray-50 p-3 rounded text-sm">
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-blue-600">Alice is typing...</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-green-600">Bob joined the session</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-3 text-green-600">Active Backup & Versioning</h3>
              <p className="text-gray-600 mb-4">Every change automatically saved with instant rollback capability.</p>
              <div className="bg-gray-50 p-3 rounded text-sm">
                <div className="space-y-1">
                  <div>📄 Version 1.3 - 2 minutes ago</div>
                  <div>📄 Version 1.2 - 15 minutes ago</div>
                  <div>📄 Version 1.1 - 1 hour ago</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-3 text-purple-600">Academic Focus</h3>
              <p className="text-gray-600 mb-4">Built specifically for academic workflows with grading and analytics.</p>
              <div className="bg-gray-50 p-3 rounded text-sm">
                <div className="space-y-1">
                  <div>👨‍🏫 Teacher: Grade assignments</div>
                  <div>📊 Analytics: Contribution tracking</div>
                  <div>🔍 Plagiarism: Content verification</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-3 text-yellow-600">AI-Powered Search</h3>
              <p className="text-gray-600 mb-4">Natural language queries to find specific content across all notebooks.</p>
              <div className="bg-gray-50 p-3 rounded text-sm">
                <div className="border rounded p-2 bg-white">
                  <div className="text-gray-400 mb-1">Search: "machine learning algorithms"</div>
                  <div className="text-blue-600">🔍 Found in 3 notebooks</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    research: {
      title: '📚 Research Gap Solutions',
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold mb-3 text-blue-800">
              ✅ Gap 1: Real-time Collaboration (ResearchGate 2023)
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-red-600 mb-2">Problem Identified:</h4>
                <p className="text-sm text-gray-700">"Did not address real-time collaboration or active backups."</p>
              </div>
              <div>
                <h4 className="font-medium text-green-600 mb-2">Our Solution:</h4>
                <p className="text-sm text-gray-700">WebSocket-based real-time collaboration with Lambda-triggered automatic backups.</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold mb-3 text-green-800">
              ✅ Gap 2: Academic Focus (ACM 2024)
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-red-600 mb-2">Problem Identified:</h4>
                <p className="text-sm text-gray-700">"Lacked academic focus, especially backup and version tracking for coursework."</p>
              </div>
              <div>
                <h4 className="font-medium text-green-600 mb-2">Our Solution:</h4>
                <p className="text-sm text-gray-700">Academic-specific versioning with metadata tracking for grading and research workflows.</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
            <h3 className="text-lg font-semibold mb-3 text-purple-800">
              ✅ Gap 3: Multi-User Collaboration (ResearchGate 2014)
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-red-600 mb-2">Problem Identified:</h4>
                <p className="text-sm text-gray-700">"Not focused on distributed, multi-user academic collaboration."</p>
              </div>
              <div>
                <h4 className="font-medium text-green-600 mb-2">Our Solution:</h4>
                <p className="text-sm text-gray-700">Multi-user resilient platform with role-based access and collaboration traceability.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    architecture: {
      title: '🏗️ Technical Architecture',
      content: (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">AWS Cloud Infrastructure</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl mb-2">☁️</div>
                <div className="text-sm font-medium">S3 Storage</div>
                <div className="text-xs text-gray-600">Versioned backups</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl mb-2">🗄️</div>
                <div className="text-sm font-medium">DynamoDB</div>
                <div className="text-xs text-gray-600">Metadata & users</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl mb-2">⚡</div>
                <div className="text-sm font-medium">Lambda</div>
                <div className="text-xs text-gray-600">Serverless processing</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl mb-2">🔍</div>
                <div className="text-sm font-medium">OpenSearch</div>
                <div className="text-xs text-gray-600">AI-powered search</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Application Stack</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3 text-blue-600">Frontend</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• React/Next.js 14</li>
                  <li>• Tailwind CSS</li>
                  <li>• Real-time WebSocket</li>
                  <li>• Progressive Web App</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3 text-green-600">Backend</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Node.js + Express</li>
                  <li>• Socket.io for real-time</li>
                  <li>• AWS SDK integration</li>
                  <li>• JWT authentication</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Deployment & Scaling</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded">
                <div className="text-2xl mb-2">🐳</div>
                <div className="text-sm font-medium">Docker</div>
                <div className="text-xs text-gray-600">Containerized</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded">
                <div className="text-2xl mb-2">☸️</div>
                <div className="text-sm font-medium">Kubernetes</div>
                <div className="text-xs text-gray-600">Auto-scaling</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded">
                <div className="text-2xl mb-2">🌍</div>
                <div className="text-sm font-medium">CloudFront</div>
                <div className="text-xs text-gray-600">Global CDN</div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center">
              <span className="text-2xl mr-2">🎓</span>
              <span className="text-xl font-semibold">Academic Notebook Demo</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/auth/login" className="text-blue-600 hover:text-blue-800">
                Sign In
              </Link>
              <Link href="/auth/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Demo Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {Object.entries(demoSections).map(([key, section]) => (
              <button
                key={key}
                onClick={() => setActiveDemo(key)}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeDemo === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {section.title}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Demo Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {demoSections[activeDemo as keyof typeof demoSections].title}
          </h1>
          <p className="text-gray-600">
            Explore the features and capabilities of our Academic Notebook Cloud Platform
          </p>
        </div>

        {demoSections[activeDemo as keyof typeof demoSections].content}

        {/* Call to Action */}
        <div className="mt-12 text-center bg-blue-600 rounded-lg p-8 text-white">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-blue-100 mb-6">
            Join the future of academic collaboration with our cloud-based notebook platform
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/auth/register"
              className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
            >
              Create Account
            </Link>
            <Link
              href="/auth/login"
              className="border border-white text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
