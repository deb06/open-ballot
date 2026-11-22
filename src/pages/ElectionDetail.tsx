import React from 'react'
import { useParams } from 'react-router-dom'

export default function ElectionDetail() {
  const { id } = useParams()
  return (
    <div className="px-4 lg:px-0 py-8">
      <h1 className="text-2xl font-semibold text-text mb-4">Election #{id}</h1>
      <p className="text-text-secondary mb-8">Election detail page coming soon.</p>
    </div>
  )
}
