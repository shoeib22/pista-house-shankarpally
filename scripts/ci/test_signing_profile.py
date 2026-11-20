import hashlib,importlib.util,unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path
spec=importlib.util.spec_from_file_location('selector',Path(__file__).with_name('select-ios-profile.py'))
selector=importlib.util.module_from_spec(spec);spec.loader.exec_module(selector)
class SigningScopeTests(unittest.TestCase):
 def setUp(self):
  self.cert=b'fixture-public-certificate';self.identities={hashlib.sha1(self.cert).hexdigest().upper()};self.profile={'Entitlements':{'application-identifier':'TEAM.com.example.beta','get-task-allow':False},'TeamIdentifier':['TEAM'],'ExpirationDate':datetime.now(timezone.utc)+timedelta(days=1),'DeveloperCertificates':[self.cert]}
 def valid(self):return selector.valid_profile(self.profile,'com.example.beta','TEAM',self.identities)
 def test_matches_app_team_and_installed_certificate(self):self.assertTrue(self.valid());self.assertFalse(selector.valid_profile(self.profile,'com.other.app','TEAM',self.identities));self.assertFalse(selector.valid_profile(self.profile,'com.example.beta','OTHER',self.identities));self.assertFalse(selector.valid_profile(self.profile,'com.example.beta','TEAM',set()))
 def test_rejects_debugging_and_device_profiles(self):
  self.profile['Entitlements']['get-task-allow']=True;self.assertFalse(self.valid());self.profile['Entitlements']['get-task-allow']=False;self.profile['ProvisionedDevices']=['fixture'];self.assertFalse(self.valid())
 def test_rejects_expired_or_enterprise_profile(self):
  self.profile['ExpirationDate']=datetime.now(timezone.utc)-timedelta(seconds=1);self.assertFalse(self.valid());self.profile['ExpirationDate']=datetime.now(timezone.utc)+timedelta(days=1);self.profile['ProvisionsAllDevices']=True;self.assertFalse(self.valid())
if __name__=='__main__':unittest.main()
