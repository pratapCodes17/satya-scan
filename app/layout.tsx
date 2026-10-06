import type {Metadata} from "next";
import "./globals.css";
import "./auth-overrides.css";
import "./inspector-dashboard.css";
import "./inspector-dashboard-overrides.css";
import "./admin-dashboard.css";
import "./inspection-capture.css";
export const metadata:Metadata={title:"Satya Scan | Label inspection workspace",description:"AI-Assisted Legal Metrology Compliance Platform. Scan, extract, validate and review packaged-product labels with evidence.",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
