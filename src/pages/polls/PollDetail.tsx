import React from 'react'
import { useParams } from 'react-router-dom'

export default function PollDetail() {
  const { slug } = useParams()
  return (
    <div className="px-4 lg:px-0 py-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold text-text mb-4">Poll</h1>
      <p className="text-text-secondary mb-8">Poll: {slug}</p>
    </div>
  )
}
