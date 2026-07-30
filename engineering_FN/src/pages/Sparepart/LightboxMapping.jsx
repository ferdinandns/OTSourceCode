import React, { useState } from 'react';
import './SparepartDashboard.css';

const MapLightbox = ({ isOpen, onClose, mapImages }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [zoom, setZoom] = useState(1);

    if (!isOpen) return null; // Don't render anything if it's closed

    const handleNext = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === mapImages.length - 1 ? 0 : prev + 1));
        setZoom(1); // Reset zoom when changing pictures
    };

    const handlePrev = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === 0 ? mapImages.length - 1 : prev - 1));
        setZoom(1);
    };

    const handleZoomIn = (e) => {
        e.stopPropagation();
        setZoom((prev) => Math.min(prev + 0.5, 4)); // Max zoom 4x
    };

    const handleZoomOut = (e) => {
        e.stopPropagation();
        setZoom((prev) => Math.max(prev - 0.5, 1)); // Min zoom 1x
    };

    const currentImage = mapImages[currentIndex];

    return (
        <div className="lightbox-overlay" onClick={onClose}>
            
            {/* Toolbar */}
            <div className="lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
                <h3 className="lightbox-title">
                    {currentImage.title} ({currentIndex + 1} / {mapImages.length})
                </h3>
                
                <div className="lightbox-controls">
                    <button className="lb-btn" onClick={handleZoomOut}>- Zoom</button>
                    <button className="lb-btn" onClick={() => setZoom(1)}>Reset</button>
                    <button className="lb-btn" onClick={handleZoomIn}>+ Zoom</button>
                    <button className="lb-btn lb-close" onClick={onClose}>Close X</button>
                </div>
            </div>

            {/* Workspace */}
            <div className="lightbox-workspace">
                
                {/* Only show arrows if there is more than 1 image */}
                {mapImages.length > 1 && (
                    <>
                        <button className="lb-nav-arrow lb-prev" onClick={handlePrev}>&#10094;</button>
                        <button className="lb-nav-arrow lb-next" onClick={handleNext}>&#10095;</button>
                    </>
                )}

                {/* Scrollable Image Area */}
                <div className="lightbox-scroll-area" onClick={(e) => e.stopPropagation()}>
                    <img 
                        src={currentImage.src} 
                        alt={currentImage.title} 
                        className="lightbox-image"
                        style={{ '--zoom-level': zoom }} // Passes the zoom to our CSS calc()
                        draggable="false"
                    />
                </div>
                
            </div>
        </div>
    );
};

export default MapLightbox;