Add-Type -AssemblyName System.Drawing
$qaBitmap = New-Object System.Drawing.Bitmap(1000, 700)
$qaGraphics = [System.Drawing.Graphics]::FromImage($qaBitmap)
$qaGraphics.Clear([System.Drawing.Color]::White)
$qaFont = New-Object System.Drawing.Font('Arial', 24)
$qaLines = @('QA STORE - SYNTHETIC TEST INVOICE', 'Invoice: QA-20261008', 'Date: 08/10/2026', '', 'Item          Qty       Price       Amount', 'Notebook       2        50000       100000', '', 'Subtotal (VND): 100000', 'VAT 10% (VND):   10000', 'TOTAL (VND):    110000')
$qaY = 30
foreach ($qaLine in $qaLines) {
    $qaGraphics.DrawString($qaLine, $qaFont, [System.Drawing.Brushes]::Black, 30, $qaY)
    $qaY += 55
}
$qaBitmap.Save((Join-Path $PSScriptRoot 'synthetic-invoice.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$qaGraphics.Dispose()
$qaFont.Dispose()
$qaBitmap.Dispose()
