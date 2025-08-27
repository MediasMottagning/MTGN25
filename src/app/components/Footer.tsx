'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
    return (
        <footer className="bg-gray-800 text-white p-4">
            <div className="container mx-auto flex flex-wrap justify-start md:justify-center items-center">
                <p className="pr-2">&copy; {new Date().getFullYear()} MTGN25. All rights reserved.</p>
                <div className="flex flex-wrap items-center">
                    <div className="w-full md:w-auto"></div>
                    <Image className="pr-2 mb-2" src="/instagram_logo.svg" alt="Instagram Logo" width={35} height={35}/>
                    <Link href="https://instagram.com/inphogram" className="px-1 py-1 text-shadow-pink-glow hover:scale-105 transition-transform duration-200">INPHO</Link>
                    <Link href="https://instagram.com/kphgram" className="px-1 py-1 text-shadow-pink-glow hover:scale-105 transition-transform duration-200">KPH</Link>
                    <Link href="https://instagram.com/sanglekarna" className="px-1 py-1 text-shadow-pink-glow hover:scale-105 transition-transform duration-200">LEK</Link>
                    <Link href="https://instagram.com/mastarrchef" className="px-1 py-1 text-shadow-pink-glow hover:scale-105 transition-transform duration-200">ARR</Link>
                    <Link href="https://instagram.com/phlexgo" className="px-1 py-1 text-shadow-pink-glow hover:scale-105 transition-transform duration-200">PHLEX</Link>
                    <Link href="https://instagram.com/ofverphoseriet" className="px-1 py-1 text-shadow-pink-glow hover:scale-105 transition-transform duration-200">ÖPH</Link>
                    <Link href="https://instagram.com/vraqueogram/" className="sm:mr-3 px-1 py-1 text-shadow-pink-glow hover:scale-105 transition-transform duration-200">VRAQUE</Link>
                    <div className="w-full md:w-auto"></div>
                    <Image className="lg:ml-2 mt-2 pr-2 mb-2" src="/yt-logo.svg" alt="Youtube Logo" width={35} height={35}/>
                    <Link href="https://www.youtube.com/@FilmnamndenMedieteknik" className="px-1 py-1 text-shadow-pink-glow hover:scale-105 transition-transform duration-200">Filmprojektet | Filmnämnden</Link>
                    <a href="https://www.youtube.com/playlist?list=PLgihbZKHNjZeRN88YzUlmVdm4fceccHsv" target="_blank" >
                        <Image className="ml-3" src="/ACCESS_DENIED.gif" alt="ACCESS DENIED" width={175} height={35}></Image>
                    </a>
                </div>
            </div>
        </footer>
    );
}
