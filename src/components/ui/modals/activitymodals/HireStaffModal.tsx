// Hire Staff Modal
// Simple form to manually hire a staff member

import React, { useState, useEffect } from 'react';
import { createStaff, addStaff, getRandomFirstName, getRandomLastName, getRandomNationality, generateRandomSkills, calculateWage } from '@/lib/services';
import { Nationality, StaffSkills } from '@/lib/types/types';
import { formatCurrency, getColorClass } from '@/lib/utils';
import { getWageColorClass } from '@/lib/services';
import { NATIONALITIES, getSkillLevelInfo } from '@/lib/constants/staffConstants';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider } from '@/components/ui';

interface HireStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal for hiring new staff members
 * Allows manual input or random generation
 */
export const HireStaffModal: React.FC<HireStaffModalProps> = ({
  isOpen,
  onClose
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationality, setNationality] = useState<Nationality>('United States');
  const [skillLevel, setSkillLevel] = useState(0.3);
  const [previewSkills, setPreviewSkills] = useState<StaffSkills | null>(null);
  const [previewWage, setPreviewWage] = useState(0);
  
  // Generate preview when skill level changes
  useEffect(() => {
    const skills = generateRandomSkills(skillLevel, []);
    const wage = calculateWage(skills, []);
    setPreviewSkills(skills);
    setPreviewWage(wage);
  }, [skillLevel]);
  
  if (!isOpen) return null;
  
  const handleRandomize = () => {
    const randomNationality = getRandomNationality();
    const randomFirstName = getRandomFirstName(randomNationality);
    const randomLastName = getRandomLastName(randomNationality);
    
    setNationality(randomNationality);
    setFirstName(randomFirstName);
    setLastName(randomLastName);
  };
  
  const handleHire = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      alert('Please enter both first and last name');
      return;
    }
    
    const staff = createStaff(
      firstName.trim(),
      lastName.trim(),
      skillLevel,
      [],
      nationality
    );
    
    const result = await addStaff(staff);
    if (result) {
      onClose();
      // Reset form
      setFirstName('');
      setLastName('');
      setNationality('United States');
      setSkillLevel(0.3);
    }
  };
  
  const skillInfo = getSkillLevelInfo(skillLevel);
  
  // Render skill preview bars
  const renderSkillPreview = () => {
    if (!previewSkills) return null;
    
    const skills = [
      { key: 'field' as const, label: 'Field Work', color: '#10b981' },
      { key: 'winery' as const, label: 'Winery Work', color: '#8b5cf6' },
      { key: 'administration' as const, label: 'Administration', color: '#3b82f6' },
      { key: 'sales' as const, label: 'Sales', color: '#f59e0b' },
      { key: 'maintenance' as const, label: 'Maintenance', color: '#ef4444' }
    ];
    
    return (
      <div className="space-y-2">
        {skills.map((skill) => {
          const skillValue = previewSkills[skill.key];
          const percentage = Math.round(skillValue * 100);
          
          return (
            <div key={skill.key} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-24">{skill.label}</span>
              <div className="flex-1 h-4 bg-gray-700 rounded-full relative overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    backgroundColor: skill.color,
                    width: `${percentage}%`
                  }}
                />
              </div>
              <span className="text-xs text-gray-300 w-8 text-right">{percentage}%</span>
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">Hire New Staff</h2>
            <p className="text-sm text-gray-400 mt-1">Add a new employee to your winery</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>
        
        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Name Section */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-white">Personal Information</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRandomize}
                  className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
                >
                  🎲 Random Name
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-gray-300 mb-2 block">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                
                <div>
                  <Label htmlFor="lastName" className="text-gray-300 mb-2 block">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <Label htmlFor="nationality" className="text-gray-300 mb-2 block">
                  Nationality
                </Label>
                <Select value={nationality} onValueChange={(value) => setNationality(value as Nationality)}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NATIONALITIES.map(nat => (
                      <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Skill Level Section */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Skill Level</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="text-gray-300">Overall Skill</Label>
                    <span className={`text-sm font-medium ${getColorClass(skillLevel)}`}>
                      {skillInfo.name} ({Math.round(skillLevel * 100)}%)
                    </span>
                  </div>
                  <Slider
                    value={[skillLevel]}
                    onValueChange={(values) => setSkillLevel(values[0])}
                    min={0.1}
                    max={0.5}
                    step={0.05}
                    className="mb-2"
                  />
                  <p className="text-xs text-gray-400">{skillInfo.description}</p>
                </div>
              </div>
            </div>
            
            {/* Skills Preview */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-4">Skill Preview</h3>
              <p className="text-xs text-gray-400 mb-3">
                Skills are randomly generated based on the skill level. Higher skill level means better overall skills.
              </p>
              {renderSkillPreview()}
            </div>
            
            {/* Wage Preview */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold text-white mb-2">Weekly Wage</h3>
              <div className={`text-2xl font-bold ${getWageColorClass(previewWage, 'weekly')}`}>{formatCurrency(previewWage)}</div>
              <p className="text-xs text-gray-400 mt-1">
                Wage is calculated based on average skill level. Paid seasonally (12 weeks).
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gray-700 text-white hover:bg-gray-600 border-gray-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleHire}
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={!firstName.trim() || !lastName.trim()}
          >
            Hire {firstName.trim() ? firstName : 'Staff'} ({formatCurrency(previewWage)}/wk)
          </Button>
        </div>
      </div>
    </div>
  );
};

