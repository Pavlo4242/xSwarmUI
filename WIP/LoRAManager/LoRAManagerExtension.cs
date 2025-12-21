using SwarmUI.Core;
using SwarmUI.Utils;

namespace MonkeysDocs.Extensions.LoRAManager;

/// <summary>Extension that adds a visual LoRA management tab for easier preview and organization.</summary>
public class LoRAManagerExtension : Extension
{
    public override void OnInit()
    {
        Logs.Init("LoRA Manager Extension loading...");
        
        // Register the JavaScript file that handles the tab UI
        ScriptFiles.Add("Assets/lora_manager.js");
        
        // Register the CSS file for styling
        StyleSheetFiles.Add("Assets/lora_manager.css");
        
        Logs.Init("LoRA Manager Extension loaded successfully");
    }
}