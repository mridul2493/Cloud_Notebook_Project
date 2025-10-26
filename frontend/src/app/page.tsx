'use client';

import { useState } from 'react';
import Link from 'next/link';

const features = [
  {
    name: 'Real-time Collaboration',
    description: 'Multiple users can edit notebooks simultaneously with conflict resolution and live cursors.',
    icon: '👥',
    color: 'text-blue-600'
  },
  {
    name: 'Active Backup & Versioning',
    description: 'Every change automatically saved with instant rollback to any previous version.',
    icon: '☁️',
    color: 'text-green-600'
  },
  {
    name: 'Academic-Focused Features',
    description: 'Role-based access, contribution tracking, grading integration, and plagiarism detection.',
    icon: '🎓',
    color: 'text-purple-600'
  },
  {
    name: 'Cross-Platform Support',
    description: 'Consistent experience across all devices and operating systems with offline support.',
    icon: '📱',
    color: 'text-indigo-600'
  },
  {
    name: 'AI-Powered Search',
    description: 'Natural language queries to find specific notes, code, diagrams, and research content.',
    icon: '🔍',
    color: 'text-yellow-600'
  },
  {
    name: 'Enterprise Security',
    description: 'End-to-end encryption, role-based access control, and comprehensive audit logging.',
    icon: '🔒',
    color: 'text-red-600'
  }
];

const stats = [
  { name: 'Research Gaps Addressed', value: '3', suffix: '/3' },
  { name: 'AWS Services Integrated', value: '8', suffix: '+' },
  { name: 'Real-time Features', value: '12', suffix: '+' },
  { name: 'Security Layers', value: '5', suffix: '+' }
];

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="relative bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <span className="text-2xl">🎓</span>
              <span className="ml-2 text-xl font-bold text-gray-900">
                Academic Notebook Cloud
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/demo" className="text-gray-600 hover:text-gray-900 transition-colors">
                Demo
              </Link>
              <Link href="/auth/login" className="text-gray-600 hover:text-gray-900 transition-colors">
                Sign In
              </Link>
              <Link href="/auth/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-8">
              Academic Notebook Platform
              <span className="block text-blue-600">
                Built for Research Excellence
              </span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10 leading-relaxed">
              A comprehensive cloud-based platform that addresses critical research gaps in collaborative 
              academic note-taking with real-time collaboration, active backups, and AI-powered organization.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/register" className="inline-flex items-center px-8 py-4 bg-blue-600 text-white text-lg font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Start Your Research Journey
                <span className="ml-2">→</span>
              </Link>
              <button 
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center px-8 py-4 bg-white text-gray-900 text-lg font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Explore Features
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={stat.name} className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-blue-600">
                  {stat.value}<span className="text-gray-400">{stat.suffix}</span>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  {stat.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
              Advanced Features for Academic Excellence
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Built with cutting-edge cloud technologies to solve real research challenges
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={feature.name}
                className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center mb-4">
                  <span className="text-3xl mr-3">{feature.icon}</span>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {feature.name}
                  </h3>
                </div>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Research Gaps Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
              Addressing Critical Research Gaps
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform directly solves limitations identified in recent academic research
            </p>
          </div>

          <div className="space-y-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-200">
              <div className="flex items-start space-x-4">
                <span className="text-green-600 text-2xl">✅</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Cloud-Based Note Sharing and Management System (ResearchGate, 2023)
                  </h3>
                  <div className="mb-3">
                    <span className="text-sm font-medium text-red-600">Gap:</span>
                    <p className="text-gray-600 mt-1">"Did not address real-time collaboration or active backups."</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-green-600">Our Solution:</span>
                    <p className="text-gray-900 mt-1 font-medium">Continuous backup with Lambda triggers and real-time WebSocket collaboration</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-8 border border-green-200">
              <div className="flex items-start space-x-4">
                <span className="text-green-600 text-2xl">✅</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Distributed Notebook Architecture for Collaboration (ACM, 2024)
                  </h3>
                  <div className="mb-3">
                    <span className="text-sm font-medium text-red-600">Gap:</span>
                    <p className="text-gray-600 mt-1">"Lacked academic focus, especially backup and version tracking for coursework."</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-green-600">Our Solution:</span>
                    <p className="text-gray-900 mt-1 font-medium">Academic-specific versioning and metadata tracking for grading and research workflows</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-8 border border-purple-200">
              <div className="flex items-start space-x-4">
                <span className="text-green-600 text-2xl">✅</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    The Laboratory Notebook in the 21st Century (ResearchGate, 2014)
                  </h3>
                  <div className="mb-3">
                    <span className="text-sm font-medium text-red-600">Gap:</span>
                    <p className="text-gray-600 mt-1">"Not focused on distributed, multi-user academic collaboration."</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-green-600">Our Solution:</span>
                    <p className="text-gray-900 mt-1 font-medium">Multi-user resilient notebook with role-based access and collaboration traceability</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
              Ready to Transform Your Research?
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto mb-10">
              Join researchers worldwide who are already using our platform to collaborate, 
              organize, and discover insights like never before.
            </p>
            <Link href="/auth/register" className="inline-flex items-center px-8 py-4 bg-white text-blue-600 text-lg font-medium rounded-lg hover:bg-gray-100 transition-colors">
              Get Started Free
              <span className="ml-2">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <span className="text-2xl mr-2">🎓</span>
              <span className="text-lg font-semibold">Academic Notebook Cloud</span>
            </div>
            <div className="text-sm text-gray-400">
              Built with AWS, React, and academic excellence in mind.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}