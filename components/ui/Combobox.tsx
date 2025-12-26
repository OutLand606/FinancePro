
import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Plus } from 'lucide-react';

interface ComboboxProps<T> {
  items: T[];
  selectedItem: T | null;
  onSelect: (item: T) => void;
  displayValue: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  filterFunction: (item: T, query: string) => boolean;
  placeholder?: string;
  label: string;
  onAddNew?: (query: string) => void;
  disabled?: boolean;
}

export function Combobox<T>({
  items,
  selectedItem,
  onSelect,
  displayValue,
  renderItem,
  filterFunction,
  placeholder,
  label,
  onAddNew,
  disabled = false
}: ComboboxProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // If an item is selected externally or loaded, set the query to display it
    if (selectedItem) {
      setQuery(displayValue(selectedItem));
    } else {
      setQuery('');
    }
  }, [selectedItem]); // Removed displayValue from deps to avoid loop if function unsafe

  const filteredItems = query === '' && selectedItem 
    ? items 
    : items.filter((item) => filterFunction(item, query));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    // If user clears input, clear selection
    if (e.target.value === '') {
      // Optional: onSelect(null as any); 
    }
  };

  const handleSelect = (item: T) => {
    onSelect(item);
    setQuery(displayValue(item));
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={16} className="text-gray-400" />
        </div>
        <input
          type="text"
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-100"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={() => !disabled && setIsOpen(!isOpen)}>
          <ChevronDown size={16} className="text-gray-400 hover:text-gray-600" />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto animate-in fade-in zoom-in duration-100">
          {filteredItems.length === 0 ? (
            <div className="p-3 text-center text-sm text-gray-500">
              <p>Không tìm thấy kết quả.</p>
              {onAddNew && (
                <button
                  type="button"
                  onClick={() => {
                    onAddNew(query);
                    setIsOpen(false);
                  }}
                  className="mt-2 text-blue-600 font-medium hover:underline flex items-center justify-center w-full"
                >
                  <Plus size={14} className="mr-1" /> Tạo mới ngay
                </button>
              )}
            </div>
          ) : (
            <ul>
              {filteredItems.map((item, index) => (
                <li
                  key={index}
                  className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-50 last:border-0"
                  onClick={() => handleSelect(item)}
                >
                  {renderItem(item)}
                </li>
              ))}
            </ul>
          )}
          {filteredItems.length > 0 && onAddNew && (
             <div className="p-2 border-t border-gray-100 bg-gray-50 sticky bottom-0">
               <button
                  type="button"
                  onClick={() => {
                    onAddNew(query);
                    setIsOpen(false);
                  }}
                  className="w-full py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 rounded flex items-center justify-center"
                >
                  <Plus size={14} className="mr-1" /> Thêm mới khác...
                </button>
             </div>
          )}
        </div>
      )}
    </div>
  );
}
