Add-Type -AssemblyName System.Drawing

function Novo-Icone([int]$tam, [string]$saida, [double]$escalaForma) {
  $bmp = New-Object System.Drawing.Bitmap($tam, $tam)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml("#0B1D2D"))
  $base = @(@(4,32),@(4,10),@(15,22),@(24,5),@(33,22),@(44,10),@(44,32),@(36,32),@(36,24),@(28,32),@(20,32),@(12,24),@(12,32))
  $escala = $tam / 48.0 * $escalaForma
  $dx = ($tam - 48.0 * $escala) / 2.0
  $dy = ($tam - 37.0 * $escala) / 2.0
  $pts = [System.Drawing.PointF[]]($base | ForEach-Object {
    New-Object System.Drawing.PointF([float]($_[0] * $escala + $dx), [float]($_[1] * $escala + $dy))
  })
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#D4AF37"))
  $g.FillPolygon($brush, $pts)
  $brush.Dispose(); $g.Dispose()
  $bmp.Save($saida, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "gerado: $saida"
}

Novo-Icone 192 "$PSScriptRoot\..\public\icone-192.png" 0.84
Novo-Icone 512 "$PSScriptRoot\..\public\icone-512.png" 0.84
Novo-Icone 512 "$PSScriptRoot\..\public\icone-maskable-512.png" 0.60
Novo-Icone 180 "$PSScriptRoot\..\public\apple-touch-icon.png" 0.84
