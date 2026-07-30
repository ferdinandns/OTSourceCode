import React from 'react'

const Gridcoba = () => {
  return (
<div className="p-4 h-screen grid gap-2 grid-cols-1 md:grid-cols-7 md:grid-rows-5">
 
  <div className="rounded-md hidden md:flex items-center justify-center text-white font-mono bg-green-900 col-span-4 md:col-span-1 md:row-span-5">left</div>
  
  <div className="rounded-md flex flex-col justify-center items-center text-white font-mono bg-green-800 col-span-4 row-span-5 p-4 gap-4">
   
    <div className="rounded-md bg-green-600 flex flex-col w-full p-4 gap-4 h-1/3">
      
      <div className="bg-green-500 text-black p-4 rounded-md h-1/2 flex items-center justify-center">top half top box</div>
      
      <div className="bg-green-400 text-black p-4 rounded-md h-1/2 flex items-center justify-center gap-4 p-4 text-white">
        <div className="rounded-md bg-green-800 h-full w-1/3 flex items-center justify-center">box 1</div>
        <div className="rounded-md bg-green-800 h-full w-1/3 flex items-center justify-center">box 2</div>
        <div className="rounded-md bg-green-800 h-full w-1/3 flex items-center justify-center">box 3</div>
      </div>
    </div>
    
    <div className="rounded-md bg-green-500 w-full h-2/3 flex items-center justify-center p-4 gap-4">
      <div className="rounded-md bg-green-400 text-black h-full w-1/2 flex flex-col items-center justify-center gap-4 p-4 text-white">
        <div className="rounded-md bg-green-800 h-1/3 w-full flex items-center justify-center">box 1</div>
        <div className="rounded-md bg-green-800 h-1/3 w-full flex items-center justify-center">box 2</div>
        <div className="rounded-md bg-green-800 h-1/3 w-full flex items-center justify-center">box 3</div>
      </div>
      <div className="rounded-md bg-green-300 text-black h-full w-1/2 flex items-center justify-center">right bottom box</div>
    </div>
  </div>
  
  <div className="rounded-md flex items-center justify-center text-white font-mono bg-green-700 col-span-4 md:col-span-2 md:row-span-5">right</div>
</div>
  );
}

export default Gridcoba