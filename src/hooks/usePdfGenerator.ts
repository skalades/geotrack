// src/hooks/usePdfGenerator.ts
import { useRef, useState, useCallback } from 'react'

export function usePdfGenerator(filename = 'report.pdf') {
  const ref = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)

  const generate = useCallback(async () => {
    if (!ref.current) return
    setGenerating(true)
    try {
      const htmlToImage = await import('html-to-image')
      const jsPDF = (await import('jspdf')).default

      const canvas = await htmlToImage.toCanvas(ref.current, {
        pixelRatio: 2,
        backgroundColor: '#f8fafc',
        // Skip Leaflet containers — Google tile images don't have CORS headers,
        // which taints the canvas and causes toDataURL() to throw SecurityError.
        filter: (node: Node) => {
          if (node instanceof Element) {
            if (node.classList.contains('leaflet-container')) return false
            if (node.classList.contains('leaflet-pane')) return false
          }
          return true
        },
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      })

      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = pdf.internal.pageSize.getHeight()
      const imgW = canvas.width
      const imgH = canvas.height
      const ratio = imgW / pdfW
      const scaledH = imgH / ratio

      // Multi-page support
      let yOffset = 0
      while (yOffset < scaledH) {
        if (yOffset > 0) pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, -yOffset, pdfW, scaledH)
        yOffset += pdfH
      }

      pdf.save(filename)
    } catch (e) {
      // DOMException (e.g. SecurityError from tainted canvas) has non-enumerable
      // properties and logs as {} — extract message explicitly.
      const msg = e instanceof Error ? e.message : String(e)
      console.error('PDF generation error:', msg, e)
      alert('Gagal generate PDF. Silakan coba lagi.')
    } finally {
      setGenerating(false)
    }
  }, [filename])

  return { ref, generating, generate }
}
