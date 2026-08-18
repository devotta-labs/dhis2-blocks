import React from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import App from '@/App'
import '@/index.css'
import AboutPage from '@/components/About'
import AppMenu from '@/components/AppMenu'

const AppWrapper = () => {
    return (
        <div className="grid grid-cols-1 grid-rows-[auto_1fr_auto] text-sm md:min-h-[1000px] md:h-full md:grid-cols-[250px_1fr] md:grid-rows-[1fr_auto]">
            {/* 
        For the client-side routing to work on a DHIS2 server, it needs to use HashRouter 
        otherwise it will interfer with the server-side routing
        */}
            <HashRouter>
                <div>
                    <AppMenu />
                </div>
                <div className="w-full ps-[10px]">
                    <Routes>
                        <Route path="/" element={<App />} />
                        <Route path="/about" element={<AboutPage />} />
                    </Routes>
                </div>
                <div className="mt-4 flex w-full flex-col items-center gap-1.5 bg-[rgb(44,102,147)] p-4 text-white md:col-span-2">
                    <div>{'working-list-demo'}</div>
                    <div>
                        This web application was created using{' '}
                        <a
                            className="text-white visited:text-white active:text-white focus:text-white"
                            target="_blank"
                            rel="noreferrer"
                            href="https://developers.dhis2.org/docs/quickstart/quickstart-web"
                        >
                            @dhis2/create-app
                        </a>
                    </div>
                </div>
            </HashRouter>
        </div>
    )
}

export default AppWrapper
