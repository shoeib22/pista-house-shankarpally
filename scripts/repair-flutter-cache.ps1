#requires -Version 7.0
# Clear read-only attributes on generated artifacts without following links or deleting files.
$ErrorActionPreference = 'Stop'
$taskWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskCount = 0
foreach ($taskApp in @('customer_app', 'owner_app', 'delivery_app')) {
  foreach ($taskSuffix in @('build', 'ios/Flutter/ephemeral/Packages/.packages')) {
    $taskRoot = [IO.Path]::GetFullPath((Join-Path $taskWorkspace "apps/$taskApp/$taskSuffix"))
    if (-not $taskRoot.StartsWith($taskWorkspace + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Generated path escaped the workspace' }
    if (-not (Test-Path -LiteralPath $taskRoot)) { continue }
    $taskItem = Get-Item -Force -LiteralPath $taskRoot
    if ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Generated root is a link: $taskRoot" }
    $taskEntries = @($taskItem) + @(Get-ChildItem -LiteralPath $taskRoot -Recurse -Force)
    foreach ($taskEntry in $taskEntries) {
      if (($taskEntry.Attributes -band [IO.FileAttributes]::ReadOnly) -and -not ($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        $taskEntry.Attributes = $taskEntry.Attributes -band (-bnot [IO.FileAttributes]::ReadOnly)
        $taskCount++
      }
    }
  }
}
Write-Output "Cleared read-only attributes on $taskCount generated entries."
