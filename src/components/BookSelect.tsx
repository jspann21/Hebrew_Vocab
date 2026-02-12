import { useEffect, useRef, useState, useMemo } from 'react';
import type { CatalogBook } from '../types/data';

type BookSelectProps = {
    books: CatalogBook[];
    selectedBookId: string;
    onBookChange: (bookId: string) => void;
    disabled?: boolean;
};

export function BookSelect({ books, selectedBookId, onBookChange, disabled }: BookSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedBook = books.find((b) => b.id === selectedBookId);

    const filteredBooks = useMemo(() => {
        if (!search) return books;
        const lower = search.toLowerCase();
        return books.filter((book) => book.name.toLowerCase().includes(lower));
    }, [books, search]);

    const openDropdown = () => setIsOpen(true);
    const closeDropdown = () => {
        setIsOpen(false);
        setSearch('');
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            searchInputRef.current?.focus();
        }
    }, [isOpen]);

    const handleSelect = (book: CatalogBook) => {
        onBookChange(book.id);
        closeDropdown();
    };

    return (
        <div className="book-select-wrapper" ref={wrapperRef}>
            <button
                type="button"
                className="book-select-trigger"
                onClick={() => {
                    if (disabled) return;
                    if (isOpen) {
                        closeDropdown();
                    } else {
                        openDropdown();
                    }
                }}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="current-value">{selectedBook ? selectedBook.name : 'Select a book...'}</span>
                <svg
                    className="select-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="book-select-dropdown">
                    <div className="search-container">
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="book-search-input"
                            placeholder="Search books..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <ul className="book-list" role="listbox">
                        {filteredBooks.length > 0 ? (
                            filteredBooks.map((book) => (
                                <li
                                    key={book.id}
                                    role="option"
                                    aria-selected={book.id === selectedBookId}
                                    className={`book-option ${book.id === selectedBookId ? 'selected' : ''}`}
                                    onClick={() => handleSelect(book)}
                                >
                                    {book.name}
                                    {book.id === selectedBookId && (
                                        <span className="check-icon">✓</span>
                                    )}
                                </li>
                            ))
                        ) : (
                            <li className="no-results">No books found</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
