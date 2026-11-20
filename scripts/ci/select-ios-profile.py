"""Select an existing, matching distribution profile. Never creates Apple resources."""
from datetime import datetime,timezone
from pathlib import Path
import hashlib,json,os,plistlib,re,subprocess,sys

def valid_profile(profile,bundle,team,identities):
    entitlements=profile.get('Entitlements',{})
    expiry=profile.get('ExpirationDate')
    if not expiry:return False
    if expiry.tzinfo is None:expiry=expiry.replace(tzinfo=timezone.utc)
    return (entitlements.get('application-identifier')==team+'.'+bundle
        and team in profile.get('TeamIdentifier',[])
        and entitlements.get('get-task-allow') is not True
        and not profile.get('ProvisionedDevices')
        and profile.get('ProvisionsAllDevices') is not True
        and expiry>datetime.now(timezone.utc)
        and any(hashlib.sha1(cert).hexdigest().upper() in identities for cert in profile.get('DeveloperCertificates',[])))

def main():
    if sys.platform!='darwin' or not os.environ.get('CM_BUILD_DIR'):raise RuntimeError('Run signing selection only on the Codemagic macOS runner')
    root=Path(os.environ['CM_BUILD_DIR']);manifest=json.loads((root/'release/testflight-apps.json').read_text())
    app=manifest['apps'][os.environ['APP_ROLE']]
    if app['directory']!=os.environ['APP_DIR'] or app['bundleId']!=os.environ['BUNDLE_ID']:raise RuntimeError('Unexpected app identity')
    output=subprocess.check_output(['security','find-identity','-v','-p','codesigning'],text=True)
    identities=set(re.findall(r'\b[A-F0-9]{40}\b',output))
    candidates=[];seen=set()
    for folder in [Path.home()/'Library/MobileDevice/Provisioning Profiles',Path.home()/'Library/Developer/Xcode/UserData/Provisioning Profiles']:
        for file in folder.glob('*.mobileprovision'):
            profile=plistlib.loads(subprocess.check_output(['security','cms','-D','-i',str(file)],stderr=subprocess.DEVNULL))
            if profile.get('UUID') in seen:continue
            if valid_profile(profile,app['bundleId'],manifest['appleTeamId'],identities):candidates.append((file,profile));seen.add(profile.get('UUID'))
    if len(candidates)!=1:raise RuntimeError('Expected exactly one current app-specific Qube distribution profile with an installed signing identity')
    file,profile=candidates[0]
    subprocess.run(['xcode-project','use-profiles','--project',str(root/app['directory']/'ios/Runner.xcodeproj'),'--profile',str(file),'--custom-export-options={"testFlightInternalTestingOnly":true}'],check=True)
    print('Existing app-specific distribution profile verified; no Apple records or keys were created.')

if __name__=='__main__':main()
