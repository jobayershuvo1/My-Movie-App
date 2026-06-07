import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth';
import { 
  Building2, 
  Settings as SettingsIcon, 
  ShieldCheck, 
  HardDrive, 
  ToggleLeft, 
  HelpCircle,
  Save,
  CheckCircle,
  AlertOctagon,
  RefreshCw
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface CMSSettings {
  siteName: string;
  allowRegistration: boolean;
  maintenanceMode: boolean;
  defaultQuality: string;
  maxFileSize: string;
  cdnCaching: boolean;
  offlineSimulation: boolean;
  secureDownloads: boolean;
}

const DEFAULT_SETTINGS: CMSSettings = {
  siteName: 'CineVault',
  allowRegistration: true,
  maintenanceMode: false,
  defaultQuality: '1080p BluRay',
  maxFileSize: '4 GB',
  cdnCaching: true,
  offlineSimulation: false,
  secureDownloads: true
};

export default function Settings() {
  const { profile } = useAuthStore();
  const [settings, setSettings] = useState<CMSSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'general' | 'downloads' | 'security'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (profile?.role !== 'super_admin') {
    return (
      <div className="p-8 text-center bg-zinc-950 text-white flex flex-col items-center justify-center min-h-[50vh]">
        <ShieldCheck className="w-12 h-12 text-red-500 mb-4 animate-bounce" />
        <h3 className="text-xl font-bold mb-2">Access Denied</h3>
        <p className="text-zinc-400 max-w-md">Only the Super Admin (<span className="text-red-400 font-semibold font-mono font-bold">jobayershuvo1122@gmail.com</span>) is authorized to customize global CMS settings.</p>
      </div>
    );
  }

  useEffect(() => {
    const saved = localStorage.getItem('cinevault_cms_settings');
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (err) {
        console.error('Failed to parse settings:', err);
      }
    }
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      localStorage.setItem('cinevault_cms_settings', JSON.stringify(settings));
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 800000 / 1000); // Super responsive simulate 800ms write buffer
  };

  const updateSetting = <K extends keyof CMSSettings>(key: K, value: CMSSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white mb-1">Global CMS Configuration</h2>
        <p className="text-sm text-zinc-400 font-sans">Manage application parameters, toggle security parameters, and customize metadata behaviors.</p>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs sm:text-sm text-emerald-400 flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>System parameters updated! Settings have been compiled and published down to clients.</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* Navigation Tab Controllers */}
        <div className="lg:w-64 glass rounded-xl div-y divide-white/5 h-fit pb-1 shrink-0 overflow-hidden">
          <div className="p-4 bg-white/5 border-b border-white/5">
            <span className="text-xs font-bold text-zinc-400 font-mono uppercase tracking-wider block">Setting scopes</span>
          </div>
          <div className="p-2 space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'general' ? 'bg-red-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Building2 className="w-4 h-4" /> General Parameters
            </button>
            <button
              onClick={() => setActiveTab('downloads')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'downloads' ? 'bg-red-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <HardDrive className="w-4 h-4" /> Media & Mirrors
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'security' ? 'bg-red-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Operations Security
            </button>
          </div>
        </div>

        {/* Setting Panel Content (Fully Responsive Form Layout) */}
        <div className="flex-1 glass rounded-xl min-w-0 p-4 sm:p-6 flex flex-col justify-between">
          
          <div className="space-y-6">
            {activeTab === 'general' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">General Application Profiles</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Default Site Branding Name</label>
                    <input 
                      type="text"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs sm:text-sm text-zinc-200 focus:outline-none focus:border-red-500"
                      value={settings.siteName}
                      onChange={e => updateSetting('siteName', e.target.value)}
                    />
                    <span className="text-[10px] text-zinc-500 block">This logo brand name is loaded dynamically across all headers.</span>
                  </div>

                  <div className="flex items-center justify-between p-3 border border-white/5 bg-white/[0.01] rounded-xl cursor-all-scroll col-span-1">
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">Registration Flag</span>
                      <span className="text-[10px] text-zinc-500 font-sans block mt-0.5">Permit user creation</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={settings.allowRegistration}
                      onChange={e => updateSetting('allowRegistration', e.target.checked)}
                      className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border border-white/5 bg-white/[0.01] rounded-xl cursor-all-scroll col-span-1">
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">Live CDN Caching</span>
                      <span className="text-[10px] text-zinc-500 font-sans block mt-0.5">Asset payload preloads</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={settings.cdnCaching}
                      onChange={e => updateSetting('cdnCaching', e.target.checked)}
                      className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'downloads' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Media & Mirror Settings</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Default Streaming Quality</label>
                    <select
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs sm:text-sm text-zinc-200 focus:outline-none focus:border-red-500 cursor-pointer"
                      value={settings.defaultQuality}
                      onChange={e => updateSetting('defaultQuality', e.target.value)}
                    >
                      <option value="4K UHD">4K Ultra HD</option>
                      <option value="1080p BluRay">1080p BluRay Disc</option>
                      <option value="1080p WEB-DL">1080p Web Stream</option>
                      <option value="720p HD">720p HD</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider font-mono">Max Payload Storage Estimate</label>
                    <input 
                      type="text"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs sm:text-sm text-zinc-200 focus:outline-none focus:border-red-500"
                      value={settings.maxFileSize}
                      onChange={e => updateSetting('maxFileSize', e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border border-white/5 bg-white/[0.01] rounded-xl sm:col-span-2">
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">Offline Archive Previews</span>
                      <span className="text-[10px] text-zinc-500 font-sans block mt-0.5">Toggle fallback simulation loops if server goes offline</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={settings.offlineSimulation}
                      onChange={e => updateSetting('offlineSimulation', e.target.checked)}
                      className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Operational Security Scopes</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
                    <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold font-sans uppercase">Critical Service Parameters</h4>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">Entering maintenance mode locks down user actions. Viewers will receive a "Site Under Maintenance" splash screen instantly, but admins can bypass normally.</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 border border-white/5 bg-yellow-500/[0.02] rounded-xl">
                    <div>
                      <span className="text-xs font-bold text-yellow-500 block uppercase font-mono">System Maintenance Lock</span>
                      <span className="text-[10px] text-zinc-500 font-sans block mt-0.5">Put CineVault under offline maintenance splash.</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={settings.maintenanceMode}
                      onChange={e => updateSetting('maintenanceMode', e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 border border-white/5 bg-white/[0.01] rounded-xl">
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">Enforced Referrer Masking</span>
                      <span className="text-[10px] text-zinc-500 font-sans block mt-0.5">Scrub tracking referrers when redirection down to hosts.</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={settings.secureDownloads}
                      onChange={e => updateSetting('secureDownloads', e.target.checked)}
                      className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-6 border-t border-white/5 mt-8 flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="gap-1.5 px-6 shrink-0 w-full sm:w-auto text-xs sm:text-sm font-bold"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" /> Saving Parameters...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Configuration
                </>
              )}
            </Button>
          </div>

        </div>

      </div>

    </div>
  );
}
