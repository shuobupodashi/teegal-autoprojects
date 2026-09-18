
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
  };

  const getCurrentLanguageLabel = () => {
    return i18n.language === 'zh' ? 'EN' : '中';
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={toggleLanguage}
      className="flex items-center space-x-1"
    >
      <Globe size={16} />
      <span className="text-sm">{getCurrentLanguageLabel()}</span>
    </Button>
  );
};

export default LanguageSwitcher;
