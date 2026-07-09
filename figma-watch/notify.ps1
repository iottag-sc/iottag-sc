param(
  [string]$Message = "Figma design change detected",
  [string]$Title = "Figma watch"
)
# Windows toast via WinRT (no modules needed); falls back to a timed popup.
try {
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null
  $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
  $escT = [System.Security.SecurityElement]::Escape($Title)
  $escM = [System.Security.SecurityElement]::Escape($Message)
  $xml.LoadXml("<toast duration='long'><visual><binding template='ToastGeneric'><text>$escT</text><text>$escM</text></binding></visual></toast>")
  $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
  $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
  Start-Sleep -Seconds 1
} catch {
  (New-Object -ComObject WScript.Shell).Popup($Message, 30, $Title, 64) | Out-Null
}
