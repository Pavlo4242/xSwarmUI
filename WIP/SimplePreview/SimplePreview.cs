using SwarmUI.Core;
using SwarmUI.Text2Image;

namespace SimplePreview;

public class SimplePreview : Extension
{
    public override void OnInit()
    {
        // Add the JS and CSS files to the main page
        ScriptFiles.Add("assets/simple_preview.js");
        StyleSheetFiles.Add("assets/simple_preview.css");
    }
}