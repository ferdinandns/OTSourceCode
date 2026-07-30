import React, { useState, useEffect, useRef } from 'react';
import './SparepartForm.css';

const SparepartLogForm = ({ onClose }) => {
    // --- STATE MANAGEMENT ---
    // 1. Form Inputs
    const [employeeName, setEmployeeName] = useState('');
    const [workOrderNumber, setWorkOrderNumber] = useState('');
    const [description, setDescription] = useState('');
    
    // 2. The "Cart" (Array of items the user is taking)
    const [cart, setCart] = useState([]);
    
    // 3. Inventory Data & Search
    const [inventory, setInventory] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [division, setDivision] = useState(''); // <-- NEW STATE
    
    // 4. UI Status
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }
    const [isSubmitting, setIsSubmitting] = useState(false);

    const searchRef = useRef(null);

    // --- FETCH INVENTORY ON MOUNT ---
    useEffect(() => {
        const fetchInventory = async () => {
            try {
                // Reuse the endpoint we built earlier!
                const response = await fetch('http://10.126.15.197:8002/part/getInventoryParts');
                const data = await response.json();
                setInventory(data);
            } catch (err) {
                console.error("Failed to load inventory for search:", err);
            }
        };
        fetchInventory();

        // Click outside listener to close dropdown
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- SMART SEARCH FILTER ---
    const filteredInventory = inventory.filter(part => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (part.Part_Number?.toLowerCase().includes(query) || 
                part.Part_Description?.toLowerCase().includes(query));
    }).slice(0, 10); // Limit dropdown to top 10 results for performance

    // --- CART LOGIC ---
    const addToCart = (part) => {
        // Check if part is already in the cart
        const existingItem = cart.find(item => item.part_number === part.Part_Number);
        
        if (existingItem) {
            // Increase quantity by 1
            setCart(cart.map(item => 
                item.part_number === part.Part_Number 
                ? { ...item, qty: item.qty + 1 } 
                : item
            ));
        } else {
            // Add new item to cart with qty 1
            setCart([...cart, {
                part_number: part.Part_Number,
                part_description: part.Part_Description,
                qty: 1
            }]);
        }
        // Clear search and close dropdown
        setSearchQuery('');
        setIsDropdownOpen(false);
    };

    const updateQuantity = (part_number, delta) => {
        setCart(cart.map(item => {
            if (item.part_number === part_number) {
                const newQty = item.qty + delta;
                return { ...item, qty: newQty > 0 ? newQty : 1 }; // Prevent qty from going below 1
            }
            return item;
        }));
    };

    const removeFromCart = (part_number) => {
        setCart(cart.filter(item => item.part_number !== part_number));
    };

    // --- SUBMISSION LOGIC ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!employeeName || cart.length === 0) {
            setMessage({ type: 'error', text: 'Please provide an Employee Name and add at least one item.' });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        // Construct the exact JSON payload the backend expects
        const payload = {
            Employee_Name: employeeName,
            Division: division,
            Work_Order_Number: workOrderNumber || null,
            Description: description || null,
            Items_Taken: cart
        };

        try {
            // NOTE: Change this to whatever you name your POST route!
            const response = await fetch('http://10.126.15.197:8002/part/createSparepartLog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Transaction failed.');

            setMessage({ type: 'success', text: 'Log saved and inventory updated successfully!' });
            
            // Clear the form for the next user
            setEmployeeName('');
            setWorkOrderNumber('');
            setCart([]);

            // 2. OPTIONAL UX BOOST: Auto-close the popup after 2 seconds on success!
            setTimeout(() => {
                if(onClose) onClose();
            }, 2000);
            
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save log. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            
            {/* 4. Stop clicks inside the popup from closing it */}
            <div className="log-form-container wo-container" onClick={(e) => e.stopPropagation()}>
                
                {/* 5. Add the Close 'X' Button */}
                <button className="close-modal-btn" onClick={onClose}>&times;</button>
            
            <h2>Log Sparepart Usage</h2>
            
            {message && (
                <div className={`alert-message ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* User Info Section */}
                <div className="form-grid">
                    <div className="input-group">
                        <label>Employee Name *</label>
                        <input 
                            type="text" 
                            className="standard-input"
                            value={employeeName}
                            onChange={(e) => setEmployeeName(e.target.value)}
                            placeholder="Enter your name"
                            required
                        />
                    </div>
                    <div className="input-group">
    <label>Division *</label>
    <select 
        className="standard-input"
        value={division}
        onChange={(e) => setDivision(e.target.value)}
        required
    >
        <option value="" disabled>Select Division...</option>
        <option value="Imecon">Imecon</option>
        <option value="Maintenance">Maintenance</option>
        <option value="Utility">Utility</option>
        <option value="Production">Production</option>
        <option value="Intern">Intern</option>
    </select>
</div>
                    <div className="input-group">
                        <label>Work Order Number (Optional)</label>
                        <input 
                            type="text" 
                            className="standard-input"
                            value={workOrderNumber}
                            onChange={(e) => setWorkOrderNumber(e.target.value)}
                            placeholder="e.g., PWO-37921"
                        />
                    </div>
                </div>

                {/* Smart Search Section */}
                <div className="search-container" ref={searchRef}>
                    <div className="input-group">
                        <label>Search and Add Parts</label>
                        <input 
                            type="text" 
                            className="standard-input"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setIsDropdownOpen(true);
                            }}
                            onFocus={() => setIsDropdownOpen(true)}
                            placeholder="Type Part Number or Description..."
                        />
                    </div>
                    
                    {/* The Dropdown List */}
                    {isDropdownOpen && searchQuery && (
                        <div className="search-dropdown">
                            {filteredInventory.length > 0 ? (
                                filteredInventory.map(part => (
                                    <div 
                                        key={part.Part_Number} 
                                        className="dropdown-item"
                                        onClick={() => addToCart(part)}
                                    >
                                        <div className="dropdown-item-title">{part.Part_Number}</div>
                                        <div className="dropdown-item-desc">{part.Part_Description}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="dropdown-item" style={{ color: 'var(--text-muted)' }}>
                                    No parts found.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="input-group" style={{ gridColumn: '1 / -1' }}> {/* Spans the full width */}
    <label>Description / Reason for Parts</label>
    <textarea 
        className="standard-input"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g., Routine maintenance on conveyor belt motor..."
        rows="2"
    />
</div>

                {/* The Cart Section */}
                <h3 style={{ margin: '0 0 16px 0', padding: '5px 0 0'}}>Items to Checkout</h3>
                <div className="cart-section">
                    {cart.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Your cart is empty. Search above to add items.
                        </p>
                    ) : (
                        cart.map(item => (
                            <div key={item.part_number} className="cart-item">
                                <div className="cart-item-info">
                                    <strong>{item.part_number}</strong>
                                    <div className="dropdown-item-desc">{item.part_description}</div>
                                </div>
                                <div className="cart-controls">
                                    <button type="button" className="qty-btn" onClick={() => updateQuantity(item.part_number, -1)}>-</button>
                                    <span className="qty-display">{item.qty}</span>
                                    <button type="button" className="qty-btn" onClick={() => updateQuantity(item.part_number, 1)}>+</button>
                                    <button type="button" className="remove-btn" onClick={() => removeFromCart(item.part_number)}>Remove</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <button 
                    type="submit" 
                    className="submit-btn"
                    disabled={isSubmitting || cart.length === 0}
                >
                    {isSubmitting ? 'Processing Transaction...' : 'Submit Log & Update Inventory'}
                </button>
            </form>
        </div>
        </div>
        
    );
};

export default SparepartLogForm;