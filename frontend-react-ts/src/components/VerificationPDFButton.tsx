import { useState } from 'react';

interface VerificationPDFButtonProps {
  verificationId: number;
  className?: string;
  tooltip?: string;
  onSuccess?: (filename: string) => void;
  onError?: (error: string) => void;
}

export default function VerificationPDFButton({
  verificationId,
  className = '',
  tooltip = 'Download Verification Report',
  onSuccess,
  onError,
}: VerificationPDFButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/verifications/${verificationId}/download-pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Failed to download PDF (HTTP ${response.status})`;
        try {
          const json = JSON.parse(errorText);
          errorMsg = json.message || json.error || errorMsg;
        } catch {
          errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      // ✅ FIXED: Better filename extraction
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Verification_${verificationId}.pdf`;
      
      if (contentDisposition) {
        console.log('📄 Content-Disposition:', contentDisposition);
        
        // Try multiple patterns to extract filename
        const patterns = [
          /filename\*=UTF-8''([^;]+)/,           // RFC 5987 (encoded)
          /filename="([^"]+)"/,                   // Quoted
          /filename=([^;\s]+)/                    // Unquoted
        ];

        for (const pattern of patterns) {
          const match = contentDisposition.match(pattern);
          if (match && match[1]) {
            // Decode and trim
            filename = decodeURIComponent(match[1].trim());
            console.log('✅ Extracted filename:', filename);
            break;
          }
        }
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      link.remove();

      onSuccess?.(filename);
    } catch (err: any) {
      const msg = err.message || `Error downloading verification PDF`;
      console.error('Verification PDF download error:', err);
      onError?.(msg);
      alert(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`btn btn-outline-secondary btn-sm ${className}`}
      onClick={handleDownload}
      title={tooltip}
      disabled={loading}
    >
      {loading ? (
        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      ) : (
        <i className="bi bi-file-pdf"></i>
      )}
    </button>
  );
}